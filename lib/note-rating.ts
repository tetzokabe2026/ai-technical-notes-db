const MIN_BODY_LENGTH = 20;
const MAX_BODY_LENGTH = 255;
const MAX_RETRIES = 2;
const RETRY_DELAY_MS = 2_000;

/** Public Evaluation Mock API used when NOTE_RATING_API_URL is unset/placeholder/unreachable. */
export const DEFAULT_RATING_API_URL =
  "https://evaluation-mock-api-47730621722.asia-northeast1.run.app";

/** OpenAPI Evaluation schema rating properties (excludes eval-id). */
export const EVALUATION_RATING_FIELDS = [
  "usefulness",
  "importance",
  "credibility",
] as const;

export type EvaluationRatingField = (typeof EVALUATION_RATING_FIELDS)[number];

export const RATING_FIELD_LABELS: Record<EvaluationRatingField, string> = {
  usefulness: "Usefulness",
  importance: "Importance",
  credibility: "Credibility",
};

export type NoteRatings = {
  evalId: string;
} & Record<EvaluationRatingField, number>;

export type RatingSkipReason =
  | "content_too_short"
  | "content_empty"
  | "api_failed"
  | "invalid_payload";

export function noteRatingsToDbUpdate(ratings: NoteRatings): Record<string, string | number> {
  const update: Record<string, string | number> = { rating_eval_id: ratings.evalId };
  for (const field of EVALUATION_RATING_FIELDS) {
    update[`rating_${field}`] = ratings[field];
  }
  return update;
}

export function hasCompleteNoteRatings(note: Record<string, unknown>): boolean {
  return EVALUATION_RATING_FIELDS.every(
    (field) => typeof note[`rating_${field}`] === "number",
  );
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function normalizeBaseUrl(url: string): string {
  let normalized = url.trim().replace(/\/$/, "");
  if (normalized.endsWith("/evaluations")) {
    normalized = normalized.slice(0, -"/evaluations".length).replace(/\/$/, "");
  }
  return normalized;
}

function isPlaceholderUrl(url: string): boolean {
  return (
    !url
    || /example\.com/i.test(url)
    || /your-evaluation/i.test(url)
    || url === "REPLACE_ME"
    || /^https?:\/\/(localhost|127\.0\.0\.1)(:|\/|$)/i.test(url)
  );
}

export function getRatingApiBaseUrl(): string {
  const configured = process.env.NOTE_RATING_API_URL?.trim();
  if (!configured || isPlaceholderUrl(configured)) {
    return DEFAULT_RATING_API_URL;
  }
  return normalizeBaseUrl(configured);
}

function normalizeBody(content: string): string | null {
  const trimmed = content.trim().slice(0, MAX_BODY_LENGTH);
  if (trimmed.length < MIN_BODY_LENGTH) return null;
  return trimmed;
}

function coerceScore(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) {
    const rounded = Math.round(value);
    if (rounded >= 1 && rounded <= 5) return rounded;
    return null;
  }
  if (typeof value === "string" && value.trim()) {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) {
      const rounded = Math.round(parsed);
      if (rounded >= 1 && rounded <= 5) return rounded;
    }
  }
  return null;
}

function parseRatings(payload: unknown): NoteRatings | null {
  if (!payload || typeof payload !== "object") return null;
  const data = payload as Record<string, unknown>;
  const evalId = data["eval-id"] ?? data.eval_id ?? data.evalId;
  if (typeof evalId !== "string" || !evalId) return null;

  const scores = {} as Record<EvaluationRatingField, number>;
  for (const field of EVALUATION_RATING_FIELDS) {
    const score = coerceScore(data[field]);
    if (score === null) return null;
    scores[field] = score;
  }

  return { evalId, ...scores };
}

async function requestRatingsOnce(body: string, baseUrl: string): Promise<NoteRatings> {
  const response = await fetch(`${baseUrl}/evaluations`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ body }),
  });

  const payload = await response.json().catch(() => null);
  if (!response.ok) {
    throw new Error(`Rating API returned ${response.status}`);
  }

  const ratings = parseRatings(payload);
  if (!ratings) {
    throw new Error("Rating API returned an invalid payload");
  }
  return ratings;
}

async function fetchWithRetries(
  body: string,
  baseUrl: string,
): Promise<{ ratings: NoteRatings | null; skipReason?: RatingSkipReason; lastError?: string }> {
  const maxAttempts = MAX_RETRIES + 1;
  let lastError = "unknown";

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      const ratings = await requestRatingsOnce(body, baseUrl);
      return { ratings };
    } catch (reason) {
      lastError = reason instanceof Error ? reason.message : String(reason);
      console.error(
        `fetchNoteRatings attempt ${attempt}/${maxAttempts} failed (${baseUrl}):`,
        lastError,
      );
      if (attempt < maxAttempts) await sleep(RETRY_DELAY_MS);
    }
  }

  return {
    ratings: null,
    skipReason: lastError.includes("invalid payload") ? "invalid_payload" : "api_failed",
    lastError,
  };
}

export async function fetchNoteRatings(
  content: string,
): Promise<{
  ratings: NoteRatings | null;
  skipReason?: RatingSkipReason;
  ratingApiBaseUrl?: string;
  lastError?: string;
}> {
  if (!content.trim()) {
    return { ratings: null, skipReason: "content_empty" };
  }

  const body = normalizeBody(content);
  if (!body) {
    return { ratings: null, skipReason: "content_too_short" };
  }

  const primary = getRatingApiBaseUrl();
  const primaryResult = await fetchWithRetries(body, primary);
  if (primaryResult.ratings) {
    return { ratings: primaryResult.ratings, ratingApiBaseUrl: primary };
  }

  if (primary !== DEFAULT_RATING_API_URL) {
    console.warn(
      `Primary rating API failed (${primary}: ${primaryResult.lastError}); falling back to default`,
    );
    const fallback = await fetchWithRetries(body, DEFAULT_RATING_API_URL);
    if (fallback.ratings) {
      return { ratings: fallback.ratings, ratingApiBaseUrl: DEFAULT_RATING_API_URL };
    }
    return {
      ratings: null,
      skipReason: fallback.skipReason ?? "api_failed",
      ratingApiBaseUrl: DEFAULT_RATING_API_URL,
      lastError: fallback.lastError,
    };
  }

  return {
    ratings: null,
    skipReason: primaryResult.skipReason ?? "api_failed",
    ratingApiBaseUrl: primary,
    lastError: primaryResult.lastError,
  };
}
