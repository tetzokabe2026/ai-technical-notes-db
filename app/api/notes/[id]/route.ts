import { authErrorResponse, requireUser } from "@/lib/auth";
import { getSupabaseAdmin } from "@/lib/supabase-server";

export async function DELETE(_request: Request, context: RouteContext<"/api/notes/[id]">) {
  try {
    const user = await requireUser();
    const { id } = await context.params;
    const supabase = getSupabaseAdmin();
    const { error } = await supabase
      .from("technical_notes")
      .delete()
      .eq("id", id)
      .eq("owner_user_id", user.id);
    if (error) throw new Error(error.message);
    return Response.json({ ok: true });
  } catch (reason) {
    return authErrorResponse(reason);
  }
}
