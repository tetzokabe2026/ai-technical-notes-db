import { authErrorResponse, requireUser } from "@/lib/auth";
import { createEvaluation, EvaluationMockApiError } from "@/lib/evaluation-mock-api";

export async function POST(request: Request) {
  try {
    await requireUser();
    const payload = await request.json();
    const body = typeof payload.body === "string" ? payload.body.trim() : "";

    if (body.length < 20 || body.length > 255) {
      return Response.json(
        { error: "body must contain between 20 and 255 characters." },
        { status: 400 },
      );
    }

    const evaluation = await createEvaluation({ body });
    return Response.json(evaluation, { status: 201 });
  } catch (reason) {
    if (reason instanceof EvaluationMockApiError) {
      return Response.json(reason.body ?? { error: reason.message }, { status: reason.status });
    }
    return authErrorResponse(reason);
  }
}
