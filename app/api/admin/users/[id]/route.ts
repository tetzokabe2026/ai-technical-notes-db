import { authErrorResponse, requireAdmin } from "@/lib/auth";
import { getSupabaseAdmin } from "@/lib/supabase-server";

export async function DELETE(_request: Request, context: RouteContext<"/api/admin/users/[id]">) {
  try {
    const admin = await requireAdmin();
    const { id } = await context.params;
    if (id === admin.id) {
      return Response.json({ error: "自分自身は削除できません。" }, { status: 400 });
    }

    const supabase = getSupabaseAdmin();
    const { data: target } = await supabase
      .from("app_users")
      .select("auth_user_id")
      .eq("id", id)
      .maybeSingle();
    const { error } = await supabase.from("app_users").delete().eq("id", id);
    if (error) throw new Error(error.message);
    if (target?.auth_user_id) {
      await supabase.auth.admin.deleteUser(target.auth_user_id);
    }
    return Response.json({ ok: true });
  } catch (reason) {
    return authErrorResponse(reason);
  }
}
