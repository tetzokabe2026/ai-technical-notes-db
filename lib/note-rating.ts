const MIN_BODY_LENGTH = 20;
const MAX_BODY_LENGTH = 255;
const MAX_RETRIES = 3;
const RETRY_DELAY_MS = 5_000;

/** Public Evaluation Mock API used when NOTE_RATING_API_URL is unset/placeholder. */
const DEFAULT_RATING_API_URL =
  "https://evaluation-mock-api-47730621722.asia-northeast1.run.app";

export type NoteRatings = {
  evalId: string;
  usefulness: number;
  importance: number;
  credibility: number;
};

export type RatingSkipReason =
  | "content_too_short"
  | "content_empty"
  | "api_failed"
  | "invalid_payload";

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function normalizeBaseUrl(url: string): string {
  let normalized = url.trim().replace(/\/$/, "");
  // Credential sometimes includes the path; we always append /evaluations.
  if (normalized.endsWith("/evaluations")) {
    normalized = normalized.slice(0, -"/evaluations".length).replace(/\/$/, "");
  }
  return normalized;
}

export function getRatingApiBaseUrl(): string {
  const configured = process.env.NOTE_RATING_API_URL?.trim();
  if (
    !configured
    || /example\.com/i.test(configured)
    || /your-evaluation/i.test(configured)
    || configured === "REPLACE_ME"
  ) {
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

  const usefulness = coerceScore(data.usefulness);
  const importance = coerceScore(data.importance);
  const credibility = coerceScore(data.credibility);
  if (usefulness === null || importance === null || credibility === null) {
    return null;
  }

  return { evalId, usefulness, importance, credibility };
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

export async function fetchNoteRatings(
  content: string,
): Promise<{ ratings: NoteRatings | null; skipReason?: RatingSkipReason }> {
  if (!content.trim()) {
    return { ratings: null, skipReason: "content_empty" };
  }

  const body = normalizeBody(content);
  if (!body) {
    return { ratings: null, skipReason: "content_too_short" };
  }

  const baseUrl = getRatingApiBaseUrl();
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
      if (attempt >= maxAttempts) {
        return {
          ratings: null,
          skipReason: lastError.includes("invalid payload") ? "invalid_payload" : "api_failed",
        };
      }
      await sleep(RETRY_DELAY_MS);
    }
  }

  return { ratings: null, skipReason: "api_failed" };
}
