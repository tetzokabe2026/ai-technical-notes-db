import { createClassificationRun } from "@/lib/ai-classification";

export async function POST() {
  try {
    const result = await createClassificationRun();
    return Response.json(result);
  } catch (reason) {
    const message = reason instanceof Error ? reason.message : "Unexpected error";
    return Response.json({ error: message }, { status: 500 });
  }
}
