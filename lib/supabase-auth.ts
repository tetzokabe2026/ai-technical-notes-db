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
    // Memory mode only exercises the query/auth surface implemented by
    // DemoMemoryClient; cast preserves the real client's type contract for
    // callers outside the demo-mode scope (e.g. password-reset flows).
    return createDemoMemorySupabase() as unknown as SupabaseAuthClientType;
  }

  const supabaseUrl = process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !anonKey) {
    throw new Error("NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY are required.");
  }

  return createRealSupabaseAuthClient(supabaseUrl, anonKey);
}
