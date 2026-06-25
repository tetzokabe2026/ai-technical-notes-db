import { getSupabaseAdmin } from "@/lib/supabase-server";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return Response.json({ error: "有効なメールアドレスを入力してください。" }, { status: 400 });
    }

    const supabase = getSupabaseAdmin();
    const { data: existing } = await supabase
      .from("app_users")
      .select("id,status")
      .eq("email", email)
      .maybeSingle();

    if (existing) {
      return Response.json({ ok: true });
    }

    const { error } = await supabase.from("app_users").insert({ email, status: "pending", role: "user" });
    if (error) throw new Error(error.message);

    return Response.json({ ok: true });
  } catch (reason) {
    const message = reason instanceof Error ? reason.message : "Unexpected error";
    return Response.json({ error: message }, { status: 500 });
  }
}
