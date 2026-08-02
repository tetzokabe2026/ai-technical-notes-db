import { createClient } from "@supabase/supabase-js";
import { isDemoMemoryMode } from "@/lib/demo-mode";
import { createDemoMemorySupabase } from "@/lib/demo-memory-supabase";

function createRealSupabaseAdmin(supabaseUrl: string, serviceRoleKey: string) {
  return createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      persistSession: false,
    },
  });
}

type SupabaseAdminClient = ReturnType<typeof createRealSupabaseAdmin>;

export function getSupabaseAdmin(): SupabaseAdminClient {
  if (isDemoMemoryMode()) {
    // Memory mode only exercises the query/auth surface implemented by
    // DemoMemoryClient; cast preserves the real client's type contract for
    // callers outside the demo-mode scope (e.g. admin-only auth flows).
    return createDemoMemorySupabase() as unknown as SupabaseAdminClient;
  }

  const supabaseUrl = process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl) {
    throw new Error("SUPABASE_URL or NEXT_PUBLIC_SUPABASE_URL is required.");
  }

  if (!serviceRoleKey) {
    throw new Error("SUPABASE_SERVICE_ROLE_KEY is required.");
  }

  return createRealSupabaseAdmin(supabaseUrl, serviceRoleKey);
}
