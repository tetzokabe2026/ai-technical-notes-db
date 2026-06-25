import { createHash, randomBytes } from "crypto";
import { cookies } from "next/headers";
import { getSupabaseAdmin } from "@/lib/supabase-server";

export type AppUser = {
  id: string;
  auth_user_id: string | null;
  email: string;
  user_id: string | null;
  role: "user" | "admin";
  status: "pending" | "approved" | "rejected" | "disabled";
};

export const ACCESS_TOKEN_COOKIE = "sb_access_token";
export const REFRESH_TOKEN_COOKIE = "sb_refresh_token";
const SESSION_MAX_AGE_SECONDS = 60 * 60 * 24 * 14;

export function randomToken(bytes = 32) {
  return randomBytes(bytes).toString("base64url");
}

export function hashToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

export function isValidUserId(userId: string) {
  return /^[A-Za-z0-9_.-]{3,40}$/.test(userId);
}

export function isValidPassword(password: string) {
  return password.length >= 10;
}

export async function setSupabaseSessionCookies(session: { access_token: string; refresh_token: string; expires_in?: number }) {
  const cookieStore = await cookies();
  const maxAge = session.expires_in ?? SESSION_MAX_AGE_SECONDS;
  const options = {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge,
  } as const;

  cookieStore.set(ACCESS_TOKEN_COOKIE, session.access_token, options);
  cookieStore.set(REFRESH_TOKEN_COOKIE, session.refresh_token, {
    ...options,
    maxAge: SESSION_MAX_AGE_SECONDS,
  });
}

export async function clearSessionCookie() {
  const cookieStore = await cookies();
  cookieStore.delete(ACCESS_TOKEN_COOKIE);
  cookieStore.delete(REFRESH_TOKEN_COOKIE);
}

export async function getCurrentUser(): Promise<AppUser | null> {
  const cookieStore = await cookies();
  const accessToken = cookieStore.get(ACCESS_TOKEN_COOKIE)?.value;
  if (!accessToken) return null;

  const supabase = getSupabaseAdmin();
  const { data: authData, error: authError } = await supabase.auth.getUser(accessToken);
  if (authError || !authData.user) return null;

  const { data: user } = await supabase
    .from("app_users")
    .select("id,auth_user_id,email,user_id,role,status")
    .eq("auth_user_id", authData.user.id)
    .maybeSingle();

  if (!user || user.status !== "approved") return null;
  return user as AppUser;
}

export async function requireUser() {
  const user = await getCurrentUser();
  if (!user) throw new Error("Unauthorized");
  return user;
}

export async function requireAdmin() {
  const user = await requireUser();
  if (user.role !== "admin") throw new Error("Admin access required");
  return user;
}

export function authErrorResponse(error: unknown) {
  const message = error instanceof Error ? error.message : "Unexpected error";
  const status = message === "Unauthorized" ? 401 : message === "Admin access required" ? 403 : 500;
  return Response.json({ error: message }, { status });
}
