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
    // Memory mode only implements the demo query/auth surface (sign in,
    // getUser, refreshSession) plus basic table queries. Admin-only auth
    // flows and any other Supabase Admin API method are unsupported in
    // this mode and will throw or be undefined at runtime if called. The
    // cast below exists solely to keep TypeScript happy for callers that
    // expect the real Supabase admin client type; it does not mean those
    // methods work in memory mode.
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
