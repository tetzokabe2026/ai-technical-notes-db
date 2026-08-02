import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { createClient } = vi.hoisted(() => ({
  createClient: vi.fn(() => ({ kind: "supabase-auth-client" })),
}));

vi.mock("@supabase/supabase-js", () => ({
  createClient,
}));

describe("getSupabaseAuthClient", () => {
  const env = { ...process.env };

  beforeEach(() => {
    createClient.mockClear();
  });

  afterEach(() => {
    process.env = { ...env };
  });

  it("throws when env vars are missing", async () => {
    delete process.env.NEXT_PUBLIC_SUPABASE_URL;
    delete process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    const { getSupabaseAuthClient } = await import("@/lib/supabase-auth");
    expect(() => getSupabaseAuthClient()).toThrow(
      "NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY are required."
    );
  });

  it("creates auth client when env is configured", async () => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = "https://example.supabase.co";
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = "anon-key";
    const { getSupabaseAuthClient } = await import("@/lib/supabase-auth");
    const client = getSupabaseAuthClient();

    expect(client).toEqual({ kind: "supabase-auth-client" });
    expect(createClient).toHaveBeenCalledWith(
      "https://example.supabase.co",
      "anon-key",
      expect.objectContaining({
        auth: {
          persistSession: false,
          autoRefreshToken: false,
          detectSessionInUrl: false,
        },
      })
    );
  });

  it("returns memory client when DEMO_SUPABASE_MODE=memory without anon key", async () => {
    vi.resetModules();
    process.env.DEMO_SUPABASE_MODE = "memory";
    process.env.DEMO_ADMIN_EMAIL = "demo@example.com";
    process.env.DEMO_ADMIN_PASSWORD = "demo-password-ok";
    delete process.env.NEXT_PUBLIC_SUPABASE_URL;
    delete process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

    const { getSupabaseAuthClient } = await import("@/lib/supabase-auth");
    const { resetDemoMemoryStoreForTests } = await import("@/lib/demo-memory-supabase");
    resetDemoMemoryStoreForTests();

    const client = getSupabaseAuthClient();
    expect(createClient).not.toHaveBeenCalled();
    const { data, error } = await client.auth.signInWithPassword({
      email: "demo@example.com",
      password: "demo-password-ok",
    });
    expect(error).toBeNull();
    expect(data.session?.access_token).toBeTruthy();
  });
});
