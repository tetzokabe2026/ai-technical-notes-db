import { setSupabaseSessionCookies } from "@/lib/auth";
import { getSupabaseAdmin } from "@/lib/supabase-server";
import { createClient } from "@supabase/supabase-js";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
    const password = typeof body.password === "string" ? body.password : "";

    const supabase = getSupabaseAdmin();
    const { data: profile, error } = await supabase
      .from("app_users")
      .select("id,email,auth_user_id,status")
      .eq("email", email)
      .maybeSingle();

    if (error) throw new Error(error.message);
    if (!profile || profile.status !== "approved" || !profile.auth_user_id) {
      return Response.json({ error: "メールアドレスまたはパスワードが正しくありません。" }, { status: 401 });
    }

    const supabaseUrl = process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL;
    const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    if (!supabaseUrl || !anonKey) throw new Error("NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY are required.");

    const authClient = createClient(supabaseUrl, anonKey, {
      auth: { persistSession: false },
    });
    const { data, error: signInError } = await authClient.auth.signInWithPassword({ email, password });
    if (signInError || !data.session) {
      return Response.json({ error: "メールアドレスまたはパスワードが正しくありません。" }, { status: 401 });
    }

    await setSupabaseSessionCookies(data.session);
    await supabase
      .from("app_users")
      .update({ last_login_at: new Date().toISOString(), updated_at: new Date().toISOString() })
      .eq("id", profile.id);

    return Response.json({ ok: true });
  } catch (reason) {
    const message = reason instanceof Error ? reason.message : "Unexpected error";
    return Response.json({ error: message }, { status: 500 });
  }
}
