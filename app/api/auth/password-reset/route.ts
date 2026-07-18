import { checkRateLimit, getClientIp, rateLimitResponse } from "@/lib/rate-limit";
import { getSupabaseAuthClient } from "@/lib/supabase-auth";
import { getSupabaseAdmin } from "@/lib/supabase-server";
import { getAppOrigin } from "@/lib/url";

// 3 password-reset requests per hour per IP
const RESET_MAX = 3;
const RESET_WINDOW_MS = 60 * 60 * 1000;

export async function POST(request: Request) {
  const ip = getClientIp(request);
  const { allowed, retryAfter } = checkRateLimit(`password-reset:${ip}`, RESET_MAX, RESET_WINDOW_MS);
  if (!allowed) return rateLimitResponse(retryAfter!);

  try {
    const body = await request.json();
    const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return Response.json({ error: "有効なメールアドレスを入力してください。" }, { status: 400 });
    }

    const { data: profile, error: profileError } = await getSupabaseAdmin()
      .from("app_users")
      .select("id,status,auth_user_id")
      .eq("email", email)
      .maybeSingle();
    if (profileError) throw new Error(profileError.message);

    if (!profile || profile.status !== "approved" || !profile.auth_user_id) {
      return Response.json({ ok: true });
    }

    const { error } = await getSupabaseAuthClient().auth.resetPasswordForEmail(email, {
      redirectTo: `${getAppOrigin(request)}/reset-password`,
    });
    if (error) throw new Error(error.message);

    return Response.json({ ok: true });
  } catch (reason) {
    const message = reason instanceof Error ? reason.message : "Unexpected error";
    return Response.json({ error: message }, { status: 500 });
  }
}
