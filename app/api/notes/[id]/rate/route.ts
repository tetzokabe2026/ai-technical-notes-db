import { authErrorResponse, requireUser } from "@/lib/auth";
import {
  fetchNoteRatings,
  hasCompleteNoteRatings,
  noteRatingsToDbUpdate,
} from "@/lib/note-rating";
import { getSupabaseAdmin } from "@/lib/supabase-server";

export const maxDuration = 60;

const NOTE_SELECT = "*, categories(id, name)";
const RATING_SELECT =
  "id, content, rating_usefulness, rating_importance, rating_credibility, rating_reality, rating_sensitive";

export async function POST(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const user = await requireUser();
    const { id } = await context.params;
    const supabase = getSupabaseAdmin();

    const { data: note, error } = await supabase
      .from("technical_notes")
      .select(RATING_SELECT)
      .eq("id", id)
      .eq("owner_user_id", user.id)
      .maybeSingle();

    if (error) throw new Error(error.message);
    if (!note) return Response.json({ error: "Note not found." }, { status: 404 });

    if (hasCompleteNoteRatings(note)) {
      const { data: existing } = await supabase
        .from("technical_notes")
        .select(NOTE_SELECT)
        .eq("id", id)
        .eq("owner_user_id", user.id)
        .single();
      return Response.json({ note: existing, ratingsApplied: true, alreadyRated: true });
    }

    const { ratings, skipReason } = await fetchNoteRatings(note.content ?? "");
    if (!ratings) {
      const { data: current } = await supabase
        .from("technical_notes")
        .select(NOTE_SELECT)
        .eq("id", id)
        .eq("owner_user_id", user.id)
        .single();
      return Response.json({
        note: current,
        ratingsApplied: false,
        ratingSkipReason: skipReason ?? "api_failed",
      });
    }

    const { data: ratedNote, error: ratingError } = await supabase
      .from("technical_notes")
      .update(noteRatingsToDbUpdate(ratings))
      .eq("id", id)
      .eq("owner_user_id", user.id)
      .select(NOTE_SELECT)
      .single();

    if (ratingError) throw new Error(ratingError.message);
    return Response.json({ note: ratedNote, ratingsApplied: true });
  } catch (reason) {
    return authErrorResponse(reason);
  }
}
