import { authErrorResponse, requireAdmin } from "@/lib/auth";
import { getSupabaseAuthClient } from "@/lib/supabase-auth";
import { getSupabaseAdmin } from "@/lib/supabase-server";
import { getAppOrigin } from "@/lib/url";

export async function POST(request: Request, context: RouteContext<"/api/admin/users/[id]/password-reset">) {
  try {
    await requireAdmin();
    const { id } = await context.params;
    const { data: user, error } = await getSupabaseAdmin()
      .from("app_users")
      .select("email,status,auth_user_id")
      .eq("id", id)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!user || user.status !== "approved" || !user.auth_user_id) {
      return Response.json({ error: "承認済みのSupabase Authユーザーだけリセットできます。" }, { status: 400 });
    }

    const { error: resetError } = await getSupabaseAuthClient().auth.resetPasswordForEmail(user.email, {
      redirectTo: `${getAppOrigin(request)}/reset-password`,
    });
    if (resetError) throw new Error(resetError.message);

    return Response.json({ ok: true });
  } catch (reason) {
    return authErrorResponse(reason);
  }
}
