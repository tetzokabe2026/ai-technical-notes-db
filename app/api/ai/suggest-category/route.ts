import { suggestCategoryForNote } from "@/lib/ai-classification";
import { authErrorResponse, requireUser } from "@/lib/auth";

export async function POST(request: Request) {
  try {
    const user = await requireUser();
    const body = await request.json();
    const title = typeof body.title === "string" ? body.title.trim() : "";
    const content = typeof body.content === "string" ? body.content.trim() : "";
    const tags = Array.isArray(body.tags)
      ? body.tags.filter((tag: unknown): tag is string => typeof tag === "string")
      : [];

    if (!content) {
      return Response.json({ error: "Content is required." }, { status: 400 });
    }

    const suggestion = await suggestCategoryForNote({ title, content, tags, ownerUserId: user.id });
    return Response.json(suggestion);
  } catch (reason) {
    return authErrorResponse(reason);
  }
}
