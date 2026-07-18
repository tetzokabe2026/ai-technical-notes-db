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

    const { data: user, error: fetchError } = await supabase
      .from("app_users")
      .select("email,auth_user_id,user_id,status")
      .eq("id", id)
      .single();
    if (fetchError) throw new Error(fetchError.message);

    if (user.status !== "pending" && user.status !== "rejected") {
      return Response.json({ error: "申請中または却下済みのユーザーのみ承認できます。" }, { status: 400 });
    }

    let authUserId = user.auth_user_id;
    let setupUrl: string | undefined;
    let invitedAuthUserId: string | null = null;

    if (!authUserId) {
      const { data: inviteData, error: inviteError } = await supabase.auth.admin.inviteUserByEmail(user.email, {
        redirectTo: `${getAppOrigin(request)}/setup?token=${setupToken}`,
      });
      if (inviteError || !inviteData.user) {
        const { data: existingUsers, error: listError } = await supabase.auth.admin.listUsers({ page: 1, perPage: 1000 });
        if (listError) throw new Error(inviteError?.message ?? listError.message);
        const existingAuthUser = existingUsers.users.find(
          (authUser) => authUser.email?.toLowerCase() === user.email.toLowerCase(),
        );
        if (!existingAuthUser) {
          throw new Error(inviteError?.message ?? "招待ユーザーを作成できませんでした。");
        }
        authUserId = existingAuthUser.id;
      } else {
        invitedAuthUserId = inviteData.user.id;
        authUserId = inviteData.user.id;
      }
    } else {
      const { error: unbanError } = await supabase.auth.admin.updateUserById(authUserId, {
        ban_duration: "none",
      });
      if (unbanError) throw new Error(unbanError.message);
    }

    if (!user.user_id && authUserId && !invitedAuthUserId) {
      setupUrl = `${getAppOrigin(request)}/setup?token=${setupToken}`;
    }

    const { error: updateError } = await supabase
      .from("app_users")
      .update({
        status: "approved",
        auth_user_id: authUserId,
        approved_at: new Date().toISOString(),
        rejected_at: null,
        setup_token_hash: hashToken(setupToken),
        setup_token_expires_at: setupExpiresAt.toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq("id", id);
    if (updateError) {
      if (invitedAuthUserId) {
        await supabase.auth.admin.deleteUser(invitedAuthUserId);
      }
      throw new Error(updateError.message);
    }

    return Response.json({ ok: true, ...(setupUrl ? { setupUrl } : {}) });
  } catch (reason) {
    return authErrorResponse(reason);
  }
}
