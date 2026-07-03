import { afterEach, describe, expect, it } from "vitest";
import { getSupabaseAuthClient } from "@/lib/supabase-auth";

describe("getSupabaseAuthClient", () => {
  const env = { ...process.env };

  afterEach(() => {
    process.env = { ...env };
  });

  it("throws when env vars are missing", () => {
    delete process.env.NEXT_PUBLIC_SUPABASE_URL;
    delete process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    expect(() => getSupabaseAuthClient()).toThrow("NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY are required.");
  });

  it("creates auth client when env is configured", () => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = "https://example.supabase.co";
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = "anon-key";
    expect(getSupabaseAuthClient()).toBeTruthy();
  });
});
