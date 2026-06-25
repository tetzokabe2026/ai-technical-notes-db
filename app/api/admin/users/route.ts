import { authErrorResponse, requireAdmin } from "@/lib/auth";
import { getSupabaseAdmin } from "@/lib/supabase-server";

export async function GET() {
  try {
    await requireAdmin();
    const { data, error } = await getSupabaseAdmin()
      .from("app_users")
      .select("id,email,user_id,role,status,created_at,approved_at,rejected_at,last_login_at")
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    return Response.json({ users: data ?? [] });
  } catch (reason) {
    return authErrorResponse(reason);
  }
}
