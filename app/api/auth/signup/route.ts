import { checkRateLimit, getClientIp, rateLimitResponse } from "@/lib/rate-limit";
import { getSupabaseAdmin } from "@/lib/supabase-server";

// 3 signups per hour per IP
const SIGNUP_MAX = 3;
const SIGNUP_WINDOW_MS = 60 * 60 * 1000;

export async function POST(request: Request) {
  const ip = getClientIp(request);
  const { allowed, retryAfter } = checkRateLimit(`signup:${ip}`, SIGNUP_MAX, SIGNUP_WINDOW_MS);
  if (!allowed) return rateLimitResponse(retryAfter!);

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
      if (existing.status === "rejected" || existing.status === "disabled") {
        const { error: updateError } = await supabase
          .from("app_users")
          .update({
            status: "pending",
            rejected_at: null,
            setup_token_hash: null,
            setup_token_expires_at: null,
            updated_at: new Date().toISOString(),
          })
          .eq("id", existing.id);
        if (updateError) throw new Error(updateError.message);
      }
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
