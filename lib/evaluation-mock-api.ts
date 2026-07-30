const CLOUD_RUN_BASE_URL =
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

  constructor(message: string, status: number, body: unknown) {
    super(message);
    this.name = "EvaluationMockApiError";
    this.status = status;
    this.body = body;
  }
}

export function getEvaluationMockApiBaseUrl(): string {
  const fromEnv = process.env.EVALUATION_MOCK_API_BASE_URL?.trim();
  if (fromEnv) return fromEnv.replace(/\/$/, "");
  return CLOUD_RUN_BASE_URL;
}

async function parseJsonSafe(response: Response): Promise<unknown> {
  const text = await response.text();
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

async function requestEvaluationApi(path: string, init?: RequestInit): Promise<Response> {
  const baseUrl = getEvaluationMockApiBaseUrl();
  return fetch(`${baseUrl}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...init?.headers,
    },
  });
}

async function handleResponse(response: Response): Promise<Evaluation> {
  const payload = await parseJsonSafe(response);
  if (!response.ok) {
    throw new EvaluationMockApiError(
      `Evaluation Mock API returned ${response.status}`,
      response.status,
      payload,
    );
  }
  return payload as Evaluation;
}

export async function createEvaluation(input: EvaluationRequest): Promise<Evaluation> {
  const response = await requestEvaluationApi("/evaluations", {
    method: "POST",
    body: JSON.stringify(input),
  });
  return handleResponse(response);
}

export async function getEvaluation(id: string): Promise<Evaluation> {
  const response = await requestEvaluationApi(`/evaluations/${encodeURIComponent(id)}`, {
    method: "GET",
  });
  return handleResponse(response);
}

export async function deleteEvaluation(id: string): Promise<void> {
  const response = await requestEvaluationApi(`/evaluations/${encodeURIComponent(id)}`, {
    method: "DELETE",
  });
  if (response.status === 204) return;
  const payload = await parseJsonSafe(response);
  throw new EvaluationMockApiError(
    `Evaluation Mock API returned ${response.status}`,
    response.status,
    payload,
  );
}
