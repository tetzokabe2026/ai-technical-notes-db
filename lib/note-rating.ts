import { createEvaluation, EvaluationMockApiError } from "@/lib/evaluation-mock-api";

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

function normalizeBody(content: string): string | null {
  const trimmed = content.trim().slice(0, MAX_BODY_LENGTH);
  if (trimmed.length < MIN_BODY_LENGTH) return null;
  return trimmed;
}

async function requestRatingsOnce(body: string): Promise<NoteRatings> {
  const evaluation = await createEvaluation({ body });
  return {
    evalId: evaluation["eval-id"],
    usefulness: evaluation.usefulness,
    importance: evaluation.importance,
    credibility: evaluation.credibility,
  };
}

export async function fetchNoteRatings(content: string): Promise<NoteRatings | null> {
  const body = normalizeBody(content);
  if (!body) return null;

  const maxAttempts = MAX_RETRIES + 1;
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await requestRatingsOnce(body);
    } catch (reason) {
      const message =
        reason instanceof EvaluationMockApiError
          ? `${reason.status}: ${reason.message}`
          : reason instanceof Error
            ? reason.message
            : String(reason);
      console.error(`fetchNoteRatings attempt ${attempt}/${maxAttempts} failed:`, message);
      if (attempt >= maxAttempts) return null;
      await sleep(RETRY_DELAY_MS);
    }
  }

  return null;
}
