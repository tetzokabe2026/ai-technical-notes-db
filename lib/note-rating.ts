const DEFAULT_RATING_API_URL =
  "https://evaluation-mock-api-47730621722.asia-northeast1.run.app";

const MIN_BODY_LENGTH = 20;
const MAX_BODY_LENGTH = 255;
const MAX_RETRIES = 3;
const RETRY_DELAY_MS = 5_000;

export type NoteRatings = {
  evalId: string;
  usefulness: number;
  importance: number;
  credibility: number;
};

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function getRatingApiBaseUrl() {
  return (process.env.NOTE_RATING_API_URL ?? DEFAULT_RATING_API_URL).replace(/\/$/, "");
}

function normalizeBody(content: string): string | null {
  const trimmed = content.trim().slice(0, MAX_BODY_LENGTH);
  if (trimmed.length < MIN_BODY_LENGTH) return null;
  return trimmed;
}

function isValidScore(value: unknown): value is number {
  return typeof value === "number" && Number.isInteger(value) && value >= 1 && value <= 5;
}

function parseRatings(payload: unknown): NoteRatings | null {
  if (!payload || typeof payload !== "object") return null;
  const data = payload as Record<string, unknown>;
  const evalId = data["eval-id"];
  if (typeof evalId !== "string" || !evalId) return null;
  if (!isValidScore(data.usefulness) || !isValidScore(data.importance) || !isValidScore(data.credibility)) {
    return null;
  }
  return {
    evalId,
    usefulness: data.usefulness,
    importance: data.importance,
    credibility: data.credibility,
  };
}

async function requestRatingsOnce(body: string): Promise<NoteRatings> {
  const response = await fetch(`${getRatingApiBaseUrl()}/evaluations`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ body }),
  });

  if (!response.ok) {
    throw new Error(`Rating API returned ${response.status}`);
  }

  const payload = await response.json();
  const ratings = parseRatings(payload);
  if (!ratings) {
    throw new Error("Rating API returned an invalid payload");
  }
  return ratings;
}

export async function fetchNoteRatings(content: string): Promise<NoteRatings | null> {
  const body = normalizeBody(content);
  if (!body) return null;

  const maxAttempts = MAX_RETRIES + 1;
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await requestRatingsOnce(body);
    } catch (reason) {
      const message = reason instanceof Error ? reason.message : String(reason);
      console.error(`fetchNoteRatings attempt ${attempt}/${maxAttempts} failed:`, message);
      if (attempt >= maxAttempts) return null;
      await sleep(RETRY_DELAY_MS);
    }
  }

  return null;
}
