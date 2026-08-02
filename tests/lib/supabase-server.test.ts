import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { createClient } = vi.hoisted(() => ({
  createClient: vi.fn(() => ({ kind: "supabase-admin-client" })),
}));

vi.mock("@supabase/supabase-js", () => ({
  createClient,
}));

describe("getSupabaseAdmin", () => {
  const env = { ...process.env };

  beforeEach(() => {
    createClient.mockClear();
  });

  afterEach(() => {
    process.env = { ...env };
  });

  it("requires Supabase URL", async () => {
    delete process.env.SUPABASE_URL;
    delete process.env.NEXT_PUBLIC_SUPABASE_URL;
    process.env.SUPABASE_SERVICE_ROLE_KEY = "service-key";
    const { getSupabaseAdmin } = await import("@/lib/supabase-server");
    expect(() => getSupabaseAdmin()).toThrow("SUPABASE_URL or NEXT_PUBLIC_SUPABASE_URL is required.");
  });

  it("requires service role key", async () => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = "https://example.supabase.co";
    delete process.env.SUPABASE_SERVICE_ROLE_KEY;
    const { getSupabaseAdmin } = await import("@/lib/supabase-server");
    expect(() => getSupabaseAdmin()).toThrow("SUPABASE_SERVICE_ROLE_KEY is required.");
  });

  it("creates admin client when env is configured", async () => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = "https://example.supabase.co";
    process.env.SUPABASE_SERVICE_ROLE_KEY = "service-key";
    const { getSupabaseAdmin } = await import("@/lib/supabase-server");
    const client = getSupabaseAdmin();

    expect(client).toEqual({ kind: "supabase-admin-client" });
    expect(createClient).toHaveBeenCalledWith(
      "https://example.supabase.co",
      "service-key",
      expect.objectContaining({ auth: { persistSession: false } })
    );
  });

  it("returns memory client when DEMO_SUPABASE_MODE=memory without service role", async () => {
    vi.resetModules();
    process.env.DEMO_SUPABASE_MODE = "memory";
    process.env.DEMO_ADMIN_EMAIL = "demo@example.com";
    process.env.DEMO_ADMIN_PASSWORD = "demo-password-ok";
    delete process.env.SUPABASE_SERVICE_ROLE_KEY;
    delete process.env.NEXT_PUBLIC_SUPABASE_URL;
    delete process.env.SUPABASE_URL;

    const { getSupabaseAdmin } = await import("@/lib/supabase-server");
    const { resetDemoMemoryStoreForTests } = await import("@/lib/demo-memory-supabase");
    resetDemoMemoryStoreForTests();

    const client = getSupabaseAdmin();
    expect(createClient).not.toHaveBeenCalled();
    const { data } = await client.from("app_users").select("email").eq("email", "demo@example.com").maybeSingle();
    expect(data?.email).toBe("demo@example.com");
  });
});
