import { applyClassificationRun } from "@/lib/ai-classification";

export async function POST(_request: Request, context: RouteContext<"/api/ai/classification-runs/[id]/apply">) {
  try {
    const { id } = await context.params;
    const result = await applyClassificationRun(id);
    return Response.json(result);
  } catch (reason) {
    const message = reason instanceof Error ? reason.message : "Unexpected error";
    return Response.json({ error: message }, { status: 500 });
  }
}
