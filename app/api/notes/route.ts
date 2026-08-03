import { authErrorResponse, requireUser } from "@/lib/auth";
import { fetchNoteRatings, noteRatingsToDbUpdate } from "@/lib/note-rating";
import { getSupabaseAdmin } from "@/lib/supabase-server";

export const maxDuration = 60;

const NOTE_SELECT = "*, categories(id, name)";

export async function GET(request: Request) {
  try {
    const user = await requireUser();
    const supabase = getSupabaseAdmin();
    const { searchParams } = new URL(request.url);
    const q = searchParams.get("q")?.trim() ?? "";

    let req = supabase
      .from("technical_notes")
      .select(NOTE_SELECT)
      .eq("owner_user_id", user.id)
      .order("created_at", { ascending: false });

    if (q) {
      const { data: matchingCategories } = await supabase
        .from("categories")
        .select("id")
        .eq("owner_user_id", user.id)
        .ilike("name", `%${q}%`);
      const categoryIds = matchingCategories?.map((category) => category.id) ?? [];
      const categoryFilter = categoryIds.length > 0 ? `,category_id.in.(${categoryIds.join(",")})` : "";
      // tags is text[] — use PostgREST cs (contains set) with normalized lowercase query
      const tagFilter = `,tags.cs.{${q.toLowerCase()}}`;
      req = req.or(`title.ilike.%${q}%,content.ilike.%${q}%${tagFilter}${categoryFilter}`);
    }

    const { data, error } = await req;
    if (error) throw new Error(error.message);
    return Response.json({ notes: data ?? [] });
  } catch (reason) {
    return authErrorResponse(reason);
  }
}

export async function POST(request: Request) {
  try {
    const user = await requireUser();
    const body = await request.json();
    const title = typeof body.title === "string" ? body.title.trim() : "";
    const content = typeof body.content === "string" ? body.content.trim() : "";
    const categoryId = typeof body.category_id === "string" && body.category_id ? body.category_id : null;
    const sourceUrl = typeof body.source_url === "string" && body.source_url.trim() ? body.source_url.trim() : null;
    const tags = Array.isArray(body.tags)
      ? body.tags
          .filter((tag: unknown): tag is string => typeof tag === "string")
          .map((tag: string) => tag.toLowerCase().trim())
          .filter(Boolean)
      : [];

    if (!title || !content) {
      return Response.json({ error: "Title and content are required." }, { status: 400 });
    }

    const supabase = getSupabaseAdmin();
    if (categoryId) {
      const { data: category } = await supabase
        .from("categories")
        .select("id")
        .eq("id", categoryId)
        .eq("owner_user_id", user.id)
        .maybeSingle();
      if (!category) return Response.json({ error: "Category not found." }, { status: 400 });
    }

    const { data, error } = await supabase
      .from("technical_notes")
      .insert({
        owner_user_id: user.id,
        title,
        category_id: categoryId,
        tags,
        content,
        source_url: sourceUrl,
      })
      .select(NOTE_SELECT)
      .single();

    if (error) throw new Error(error.message);

    const { ratings, skipReason } = await fetchNoteRatings(content);
    if (!ratings) {
      if (skipReason) {
        console.warn(`Note ${data.id}: ratings skipped (${skipReason})`);
      }
      return Response.json({ note: data, ratingsApplied: false, ratingSkipReason: skipReason ?? null });
    }

    const { data: ratedNote, error: ratingError } = await supabase
      .from("technical_notes")
      .update(noteRatingsToDbUpdate(ratings))
      .eq("id", data.id)
      .eq("owner_user_id", user.id)
      .select(NOTE_SELECT)
      .single();

    if (ratingError) {
      console.error("Failed to persist note ratings:", ratingError.message);
      return Response.json({ note: data, ratingsApplied: false, ratingSkipReason: "persist_failed" });
    }

    return Response.json({ note: ratedNote, ratingsApplied: true });
  } catch (reason) {
    return authErrorResponse(reason);
  }
}
