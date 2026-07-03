import { afterEach, describe, expect, it } from "vitest";
import { getSupabaseAdmin } from "@/lib/supabase-server";

describe("getSupabaseAdmin", () => {
  const env = { ...process.env };

  afterEach(() => {
    process.env = { ...env };
  });

  it("requires Supabase URL", () => {
    delete process.env.SUPABASE_URL;
    delete process.env.NEXT_PUBLIC_SUPABASE_URL;
    process.env.SUPABASE_SERVICE_ROLE_KEY = "service-key";
    expect(() => getSupabaseAdmin()).toThrow("SUPABASE_URL or NEXT_PUBLIC_SUPABASE_URL is required.");
  });

  it("requires service role key", () => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = "https://example.supabase.co";
    delete process.env.SUPABASE_SERVICE_ROLE_KEY;
    expect(() => getSupabaseAdmin()).toThrow("SUPABASE_SERVICE_ROLE_KEY is required.");
  });

  it("creates admin client when env is configured", () => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = "https://example.supabase.co";
    process.env.SUPABASE_SERVICE_ROLE_KEY = "service-key";
    expect(getSupabaseAdmin()).toBeTruthy();
  });
});
