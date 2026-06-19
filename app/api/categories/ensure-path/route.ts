import { ensureCategoryPathForSuggestion } from "@/lib/ai-classification";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const path = Array.isArray(body.path)
      ? body.path.filter((part: unknown): part is string => typeof part === "string")
      : [];

    if (path.length === 0) {
      return Response.json({ error: "Category path is required." }, { status: 400 });
    }

    const category = await ensureCategoryPathForSuggestion(path);
    return Response.json({ category });
  } catch (reason) {
    const message = reason instanceof Error ? reason.message : "Unexpected error";
    return Response.json({ error: message }, { status: 500 });
  }
}
