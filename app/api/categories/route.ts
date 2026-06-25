import { authErrorResponse, requireUser } from "@/lib/auth";
import { getSupabaseAdmin } from "@/lib/supabase-server";

export async function GET() {
  try {
    const user = await requireUser();
    const supabase = getSupabaseAdmin();
    const [{ data: categories, error: categoryError }, { data: notes, error: noteError }] = await Promise.all([
      supabase
        .from("categories")
        .select("*")
        .eq("owner_user_id", user.id)
        .order("name", { ascending: true }),
      supabase
        .from("technical_notes")
        .select("category_id")
        .eq("owner_user_id", user.id),
    ]);
    if (categoryError) throw new Error(categoryError.message);
    if (noteError) throw new Error(noteError.message);
    return Response.json({ categories: categories ?? [], notes: notes ?? [] });
  } catch (reason) {
    return authErrorResponse(reason);
  }
}

export async function POST(request: Request) {
  try {
    const user = await requireUser();
    const body = await request.json();
    const name = typeof body.name === "string" ? body.name.trim() : "";
    const parentId = typeof body.parent_id === "string" && body.parent_id ? body.parent_id : null;
    if (!name) return Response.json({ error: "カテゴリ名を入力してください。" }, { status: 400 });

    const supabase = getSupabaseAdmin();
    if (parentId) {
      const { data: parent } = await supabase
        .from("categories")
        .select("id")
        .eq("id", parentId)
        .eq("owner_user_id", user.id)
        .maybeSingle();
      if (!parent) return Response.json({ error: "Parent category not found." }, { status: 400 });
    }

    const { data, error } = await supabase
      .from("categories")
      .insert({ owner_user_id: user.id, name, parent_id: parentId })
      .select("*")
      .single();

    if (error) throw new Error(error.message);
    return Response.json({ category: data });
  } catch (reason) {
    const message = reason instanceof Error && reason.message.includes("duplicate key")
      ? "同じ階層に同じ名前のカテゴリがすでに存在します。"
      : reason;
    return authErrorResponse(message instanceof Error ? message : new Error(String(message)));
  }
}
