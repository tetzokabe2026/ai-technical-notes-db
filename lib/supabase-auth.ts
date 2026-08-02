import { createClient } from "@supabase/supabase-js";
import { isDemoMemoryMode } from "@/lib/demo-mode";
import { createDemoMemorySupabase } from "@/lib/demo-memory-supabase";

function createRealSupabaseAuthClient(supabaseUrl: string, anonKey: string) {
  return createClient(supabaseUrl, anonKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
  });
}

type SupabaseAuthClientType = ReturnType<typeof createRealSupabaseAuthClient>;

export function getSupabaseAuthClient(): SupabaseAuthClientType {
  if (isDemoMemoryMode()) {
    // Memory mode only implements the demo query/auth surface (sign in,
    // getUser, refreshSession). Any other method (e.g. password reset,
    // OAuth, admin APIs) is unsupported in this mode and will throw or be
    // undefined at runtime if called. The cast below exists solely to keep
    // TypeScript happy for callers that expect the real Supabase client
    // type; it does not mean those methods work in memory mode.
    return createDemoMemorySupabase() as unknown as SupabaseAuthClientType;
  }

  const supabaseUrl = process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !anonKey) {
    throw new Error("NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY are required.");
  }

  return createRealSupabaseAuthClient(supabaseUrl, anonKey);
}
