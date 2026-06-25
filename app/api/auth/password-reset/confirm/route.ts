import { setSupabaseSessionCookies } from "@/lib/auth";
import { getSupabaseAuthClient } from "@/lib/supabase-auth";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const code = typeof body.code === "string" ? body.code : "";
    const accessToken = typeof body.accessToken === "string" ? body.accessToken : "";
    const refreshToken = typeof body.refreshToken === "string" ? body.refreshToken : "";
    const tokenHash = typeof body.tokenHash === "string" ? body.tokenHash : "";
    const password = typeof body.password === "string" ? body.password : "";

    if (!code && !tokenHash && (!accessToken || !refreshToken)) {
      return Response.json({ error: "リセットリンクが無効です。" }, { status: 400 });
    }
    if (password.length < 10) {
      return Response.json({ error: "パスワードは10文字以上で入力してください。" }, { status: 400 });
    }

    const supabase = getSupabaseAuthClient();
    const { data, error: sessionError } = code
      ? await supabase.auth.exchangeCodeForSession(code)
      : tokenHash
        ? await supabase.auth.verifyOtp({ token_hash: tokenHash, type: "recovery" })
        : await supabase.auth.setSession({ access_token: accessToken, refresh_token: refreshToken });
    if (sessionError || !data.session) {
      return Response.json({ error: sessionError?.message ?? "リセットリンクが無効または期限切れです。" }, { status: 400 });
    }

    const { error: updateError } = await supabase.auth.updateUser({ password });
    if (updateError) {
      return Response.json({ error: updateError.message }, { status: 400 });
    }

    await setSupabaseSessionCookies(data.session);
    return Response.json({ ok: true });
  } catch (reason) {
    const message = reason instanceof Error ? reason.message : "Unexpected error";
    return Response.json({ error: message }, { status: 500 });
  }
}
