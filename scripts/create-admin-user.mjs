import { existsSync, readFileSync } from "fs";
import { createClient } from "@supabase/supabase-js";

for (const envFile of [".env.local", ".env"]) {
  if (!existsSync(envFile)) continue;
  const lines = readFileSync(envFile, "utf8").split(/\r?\n/);
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const separatorIndex = trimmed.indexOf("=");
    if (separatorIndex === -1) continue;
    const key = trimmed.slice(0, separatorIndex).trim();
    const rawValue = trimmed.slice(separatorIndex + 1).trim();
    if (!key || process.env[key] !== undefined) continue;
    process.env[key] = rawValue.replace(/^["']|["']$/g, "");
  }
}

const supabaseUrl = process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const email = process.env.ADMIN_EMAIL;
const userId = process.env.ADMIN_USER_ID;
const password = process.env.ADMIN_PASSWORD;

if (!supabaseUrl || !serviceRoleKey || !email || !userId || !password) {
  console.error("SUPABASE_URL/NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, ADMIN_EMAIL, ADMIN_USER_ID, ADMIN_PASSWORD are required.");
  process.exit(1);
}

if (password.length < 10) {
  console.error("ADMIN_PASSWORD must be at least 10 characters.");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: { persistSession: false },
});

const { data: existingProfile } = await supabase
  .from("app_users")
  .select("auth_user_id")
  .eq("email", email.toLowerCase())
  .maybeSingle();

let authUserId = existingProfile?.auth_user_id;
if (authUserId) {
  const { error } = await supabase.auth.admin.updateUserById(authUserId, {
    email: email.toLowerCase(),
    password,
    email_confirm: true,
  });
  if (error) {
    console.error(error.message);
    process.exit(1);
  }
} else {
  const { data, error } = await supabase.auth.admin.createUser({
    email: email.toLowerCase(),
    password,
    email_confirm: true,
  });
  if (error || !data.user) {
    console.error(error?.message ?? "Could not create Supabase Auth user.");
    process.exit(1);
  }
  authUserId = data.user.id;
}

const { error } = await supabase
  .from("app_users")
  .upsert({
    email: email.toLowerCase(),
    auth_user_id: authUserId,
    user_id: userId,
    role: "admin",
    status: "approved",
    approved_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  }, { onConflict: "email" });

if (error) {
  console.error(error.message);
  process.exit(1);
}

console.log(`Admin user is ready: ${userId}`);
