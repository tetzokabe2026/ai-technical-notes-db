import { authErrorResponse, requireUser } from "@/lib/auth";
import { DEFAULT_RATING_API_URL, fetchNoteRatings, getRatingApiBaseUrl } from "@/lib/note-rating";
import { APP_VERSION } from "@/lib/version";

export const maxDuration = 60;

export async function GET() {
  try {
    await requireUser();
    const configured = process.env.NOTE_RATING_API_URL?.trim() || null;
    const effective = getRatingApiBaseUrl();
    const probe = await fetchNoteRatings(
      "Diagnostic probe content for rating API connectivity checks.",
    );

    return Response.json({
      appVersion: APP_VERSION,
      noteRatingApiUrlConfigured: configured,
      noteRatingApiUrlEffective: effective,
      defaultRatingApiUrl: DEFAULT_RATING_API_URL,
      probe,
    });
  } catch (reason) {
    return authErrorResponse(reason);
  }
}
