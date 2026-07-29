import { createHash } from "node:crypto";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { createQueryBuilder } from "../helpers/supabase-mock";

const { getSupabaseAdmin, getSupabaseAuthClient } = vi.hoisted(() => ({
  getSupabaseAdmin: vi.fn(),
  getSupabaseAuthClient: vi.fn(),
}));

vi.mock("@/lib/supabase-server", () => ({
  getSupabaseAdmin,
}));

vi.mock("@/lib/supabase-auth", () => ({
  getSupabaseAuthClient,
}));

function hashToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

describe("auth setup and password reset routes", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.NEXT_PUBLIC_APP_URL = "https://notes.example.com";
  });

  it("POST /api/auth/setup rejects invalid user id", async () => {
    getSupabaseAdmin.mockReturnValue({ from: vi.fn() });
    const { POST } = await import("@/app/api/auth/setup/route");
    const response = await POST(
      new Request("http://localhost/api/auth/setup", {
        method: "POST",
        body: JSON.stringify({ token: "abc", userId: "ab", password: "1234567890" }),
      })
    );
    expect(response.status).toBe(400);
  });

  it("POST /api/auth/setup rejects expired setup token", async () => {
    const usersBuilder = createQueryBuilder(async (method) => {
      if (method === "maybeSingle") {
        return {
          data: {
            id: "user-1",
            email: "user@example.com",
            status: "approved",
            setup_token_expires_at: new Date(Date.now() - 1000).toISOString(),
            auth_user_id: null,
          },
          error: null,
        };
      }
      return { data: null, error: null };
    });
    getSupabaseAdmin.mockReturnValue({
      from: vi.fn(() => usersBuilder),
      auth: { admin: { createUser: vi.fn(), updateUserById: vi.fn() } },
    });

    const { POST } = await import("@/app/api/auth/setup/route");
    const response = await POST(
      new Request("http://localhost/api/auth/setup", {
        method: "POST",
        body: JSON.stringify({ token: "setup-token", userId: "validuser", password: "1234567890" }),
      })
    );

    expect(response.status).toBe(400);
    expect(usersBuilder.eq).toHaveBeenCalledWith("setup_token_hash", hashToken("setup-token"));
  });

  it("POST /api/auth/password-reset returns ok for unknown email", async () => {
    const usersBuilder = createQueryBuilder(async (method) => {
      if (method === "maybeSingle") return { data: null, error: null };
      return { data: null, error: null };
    });
    getSupabaseAdmin.mockReturnValue({ from: vi.fn(() => usersBuilder) });

    const { POST } = await import("@/app/api/auth/password-reset/route");
    const response = await POST(
      new Request("http://localhost/api/auth/password-reset", {
        method: "POST",
        body: JSON.stringify({ email: "missing@example.com" }),
      })
    );

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.ok).toBe(true);
  });

  it("POST /api/auth/password-reset sends email for approved users", async () => {
    const resetPasswordForEmail = vi.fn(async () => ({ error: null }));
    const usersBuilder = createQueryBuilder(async (method) => {
      if (method === "maybeSingle") {
        return {
          data: { id: "user-1", status: "approved", auth_user_id: "auth-1" },
          error: null,
        };
      }
      return { data: null, error: null };
    });
    getSupabaseAdmin.mockReturnValue({ from: vi.fn(() => usersBuilder) });
    getSupabaseAuthClient.mockReturnValue({
      auth: { resetPasswordForEmail },
    });

    const { POST } = await import("@/app/api/auth/password-reset/route");
    const response = await POST(
      new Request("https://notes.example.com/api/auth/password-reset", {
        method: "POST",
        body: JSON.stringify({ email: "user@example.com" }),
      })
    );

    expect(response.status).toBe(200);
    expect(resetPasswordForEmail).toHaveBeenCalledWith("user@example.com", {
      redirectTo: "https://notes.example.com/reset-password",
    });
  });
});
