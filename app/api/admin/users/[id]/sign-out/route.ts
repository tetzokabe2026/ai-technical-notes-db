import { authErrorResponse, requireAdmin } from "@/lib/auth";
import { getSupabaseAdmin } from "@/lib/supabase-server";

export async function POST(_request: Request, context: RouteContext<"/api/admin/users/[id]/sign-out">) {
  try {
    await requireAdmin();
    const { id } = await context.params;
    const { data: user, error } = await getSupabaseAdmin()
      .from("app_users")
      .select("auth_user_id")
      .eq("id", id)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!user?.auth_user_id) return Response.json({ ok: true });

    return Response.json({
      ok: true,
      note: "Supabase Auth sessions are rejected by app status checks, but remote global sign-out is not implemented in this admin action.",
    });
  } catch (reason) {
    return authErrorResponse(reason);
  }
}
