import { authErrorResponse, hashToken, randomToken, requireAdmin } from "@/lib/auth";
import { getSupabaseAdmin } from "@/lib/supabase-server";
import { getAppOrigin } from "@/lib/url";

export async function POST(request: Request, context: RouteContext<"/api/admin/users/[id]/approve">) {
  try {
    await requireAdmin();
    const { id } = await context.params;
    const setupToken = randomToken();
    const setupExpiresAt = new Date(Date.now() + 1000 * 60 * 60 * 24 * 7);
    const supabase = getSupabaseAdmin();
    const { data: user, error } = await supabase
      .from("app_users")
      .update({
        status: "approved",
        approved_at: new Date().toISOString(),
        rejected_at: null,
        setup_token_hash: hashToken(setupToken),
        setup_token_expires_at: setupExpiresAt.toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq("id", id)
      .select("email,auth_user_id")
      .single();
    if (error) throw new Error(error.message);

    if (user.auth_user_id) {
      await supabase.auth.admin.updateUserById(user.auth_user_id, {
        ban_duration: "none",
      });
    }

    if (!user.auth_user_id) {
      const { data: inviteData, error: inviteError } = await supabase.auth.admin.inviteUserByEmail(user.email, {
        redirectTo: `${getAppOrigin(request)}/setup?token=${setupToken}`,
      });
      if (inviteError) throw new Error(inviteError.message);
      if (inviteData.user) {
        await supabase
          .from("app_users")
          .update({ auth_user_id: inviteData.user.id, updated_at: new Date().toISOString() })
          .eq("id", id);
      }
    }

    return Response.json({ ok: true });
  } catch (reason) {
    return authErrorResponse(reason);
  }
}
