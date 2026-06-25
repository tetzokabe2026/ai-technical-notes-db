import { hashToken, isValidPassword, isValidUserId } from "@/lib/auth";
import { getSupabaseAdmin } from "@/lib/supabase-server";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const token = typeof body.token === "string" ? body.token : "";
    const userId = typeof body.userId === "string" ? body.userId.trim() : "";
    const password = typeof body.password === "string" ? body.password : "";

    if (!token || !isValidUserId(userId)) {
      return Response.json({ error: "ユーザーIDは3-40文字の英数字、._-で入力してください。" }, { status: 400 });
    }
    if (!isValidPassword(password)) {
      return Response.json({ error: "パスワードは10文字以上で入力してください。" }, { status: 400 });
    }

    const supabase = getSupabaseAdmin();
    const { data: user, error } = await supabase
      .from("app_users")
      .select("id,email,status,setup_token_expires_at,auth_user_id")
      .eq("setup_token_hash", hashToken(token))
      .maybeSingle();

    if (error) throw new Error(error.message);
    if (!user || user.status !== "approved" || !user.setup_token_expires_at || new Date(user.setup_token_expires_at) <= new Date()) {
      return Response.json({ error: "設定リンクが無効または期限切れです。" }, { status: 400 });
    }

    let authUserId = user.auth_user_id;
    if (!authUserId) {
      const { data: authData, error: createError } = await supabase.auth.admin.createUser({
        email: user.email,
        password,
        email_confirm: true,
      });
      if (createError || !authData.user) {
        return Response.json({ error: createError?.message ?? "Supabase Authユーザーを作成できませんでした。" }, { status: 400 });
      }
      authUserId = authData.user.id;
    } else {
      const { error: updateAuthError } = await supabase.auth.admin.updateUserById(authUserId, { password });
      if (updateAuthError) {
        return Response.json({ error: updateAuthError.message }, { status: 400 });
      }
    }

    const { error: updateError } = await supabase
      .from("app_users")
      .update({
        auth_user_id: authUserId,
        user_id: userId,
        setup_token_hash: null,
        setup_token_expires_at: null,
        updated_at: new Date().toISOString(),
      })
      .eq("id", user.id);

    if (updateError) {
      const duplicate = updateError.message.includes("duplicate key");
      return Response.json({ error: duplicate ? "このユーザーIDはすでに使われています。" : updateError.message }, { status: 400 });
    }

    return Response.json({ ok: true });
  } catch (reason) {
    const message = reason instanceof Error ? reason.message : "Unexpected error";
    return Response.json({ error: message }, { status: 500 });
  }
}
