import { setSupabaseSessionCookies } from "@/lib/auth";
import { checkRateLimit, getClientIp, rateLimitResponse } from "@/lib/rate-limit";
import { getSupabaseAuthClient } from "@/lib/supabase-auth";
import { getSupabaseAdmin } from "@/lib/supabase-server";

// 5 attempts per 15 minutes per IP
const LOGIN_MAX = 5;
const LOGIN_WINDOW_MS = 15 * 60 * 1000;

export async function POST(request: Request) {
  const ip = getClientIp(request);
  const { allowed, retryAfter } = checkRateLimit(`login:${ip}`, LOGIN_MAX, LOGIN_WINDOW_MS);
  if (!allowed) return rateLimitResponse(retryAfter!);

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

    const authClient = getSupabaseAuthClient();
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
