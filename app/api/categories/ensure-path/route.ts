import { ensureCategoryPathForSuggestion } from "@/lib/ai-classification";
import { authErrorResponse, requireUser } from "@/lib/auth";

export async function POST(request: Request) {
  try {
    const user = await requireUser();
    const body = await request.json();
    const path = Array.isArray(body.path)
      ? body.path.filter((part: unknown): part is string => typeof part === "string")
      : [];

    if (path.length === 0) {
      return Response.json({ error: "Category path is required." }, { status: 400 });
    }

    const category = await ensureCategoryPathForSuggestion(path, user.id);
    return Response.json({ category });
  } catch (reason) {
    return authErrorResponse(reason);
  }
}
