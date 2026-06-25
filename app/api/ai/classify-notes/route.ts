import { createClassificationRun } from "@/lib/ai-classification";
import { authErrorResponse, requireUser } from "@/lib/auth";

export async function POST() {
  try {
    const user = await requireUser();
    const result = await createClassificationRun(user.id);
    return Response.json(result);
  } catch (reason) {
    return authErrorResponse(reason);
  }
}
