import { authErrorResponse, requireAdmin } from "@/lib/auth";
import { getSupabaseAdmin } from "@/lib/supabase-server";

export async function POST(_request: Request, context: RouteContext<"/api/admin/users/[id]/reject">) {
  try {
    await requireAdmin();
    const { id } = await context.params;
    const supabase = getSupabaseAdmin();
    const { data: user, error } = await supabase
      .from("app_users")
      .update({
        status: "rejected",
        rejected_at: new Date().toISOString(),
        setup_token_hash: null,
        setup_token_expires_at: null,
        updated_at: new Date().toISOString(),
      })
      .eq("id", id)
      .select("email,auth_user_id")
      .single();
    if (error) throw new Error(error.message);

    if (user.auth_user_id) {
      await supabase.auth.admin.updateUserById(user.auth_user_id, {
        ban_duration: "876000h",
      });
    }

    return Response.json({ ok: true });
  } catch (reason) {
    return authErrorResponse(reason);
  }
}
