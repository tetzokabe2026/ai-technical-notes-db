const DEFAULT_BASE_URL =
  "https://evaluation-mock-api-47730621722.asia-northeast1.run.app";

export type EvaluationRequest = {
  body: string;
};

export type Evaluation = {
  "eval-id": string;
  usefulness: number;
  importance: number;
  credibility: number;
};

export class EvaluationMockApiError extends Error {
  readonly status: number;
  readonly body: unknown;

  constructor(message: string, status: number, body?: unknown) {
    super(message);
    this.name = "EvaluationMockApiError";
    this.status = status;
    this.body = body;
  }
}

export function getEvaluationMockApiBaseUrl(): string {
  const configured = process.env.EVALUATION_MOCK_API_BASE_URL?.trim();
  const baseUrl = configured || DEFAULT_BASE_URL;
  if (!baseUrl) {
    throw new Error("EVALUATION_MOCK_API_BASE_URL is required.");
  }
  return baseUrl.replace(/\/$/, "");
}

async function parseResponseBody(response: Response): Promise<unknown> {
  const text = await response.text();
  if (!text) return undefined;
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

async function requestJson<T>(
  path: string,
  init: RequestInit,
  expectedStatus: number,
): Promise<T> {
  const response = await fetch(`${getEvaluationMockApiBaseUrl()}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(init.headers ?? {}),
    },
  });

  const body = await parseResponseBody(response);
  if (response.status !== expectedStatus) {
    throw new EvaluationMockApiError(
      `Evaluation Mock API returned ${response.status}`,
      response.status,
      body,
    );
  }

  return body as T;
}

export async function createEvaluation(request: EvaluationRequest): Promise<Evaluation> {
  return requestJson<Evaluation>("/evaluations", {
    method: "POST",
    body: JSON.stringify(request),
  }, 201);
}

export async function getEvaluation(id: string): Promise<Evaluation> {
  return requestJson<Evaluation>(`/evaluations/${encodeURIComponent(id)}`, {
    method: "GET",
  }, 200);
}

export async function deleteEvaluation(id: string): Promise<void> {
  await requestJson<undefined>(`/evaluations/${encodeURIComponent(id)}`, {
    method: "DELETE",
  }, 204);
}
