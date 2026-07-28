import { applyClassificationRun } from "@/lib/ai-classification";
import { authErrorResponse, requireUser } from "@/lib/auth";

export async function POST(_request: Request, context: RouteContext<"/api/ai/classification-runs/[id]/apply">) {
  try {
    const user = await requireUser();
    const { id } = await context.params;
    const result = await applyClassificationRun(id, user.id);
    return Response.json(result);
  } catch (reason) {
    return authErrorResponse(reason);
  }
}
