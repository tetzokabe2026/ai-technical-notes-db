import { authErrorResponse, requireUser } from "@/lib/auth";
import { getSupabaseAdmin } from "@/lib/supabase-server";

export async function PATCH(request: Request, context: RouteContext<"/api/categories/[id]">) {
  try {
    const user = await requireUser();
    const { id } = await context.params;
    const body = await request.json();
    const name = typeof body.name === "string" ? body.name.trim() : "";
    if (!name) return Response.json({ error: "カテゴリ名を入力してください。" }, { status: 400 });

    const { error } = await getSupabaseAdmin()
      .from("categories")
      .update({ name, updated_at: new Date().toISOString() })
      .eq("id", id)
      .eq("owner_user_id", user.id);
    if (error) throw new Error(error.message);
    return Response.json({ ok: true });
  } catch (reason) {
    const message = reason instanceof Error && reason.message.includes("duplicate key")
      ? new Error("同じ階層に同じ名前のカテゴリがすでに存在します。")
      : reason;
    return authErrorResponse(message);
  }
}

export async function DELETE(_request: Request, context: RouteContext<"/api/categories/[id]">) {
  try {
    const user = await requireUser();
    const { id } = await context.params;
    const { error } = await getSupabaseAdmin()
      .from("categories")
      .delete()
      .eq("id", id)
      .eq("owner_user_id", user.id);
    if (error) throw new Error(error.message);
    return Response.json({ ok: true });
  } catch (reason) {
    return authErrorResponse(reason);
  }
}
