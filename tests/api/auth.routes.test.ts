import { beforeEach, describe, expect, it, vi } from "vitest";
import { approvedUser } from "../helpers/auth-fixtures";
import { createQueryBuilder } from "../helpers/supabase-mock";

const getCurrentUser = vi.fn();
const setSupabaseSessionCookies = vi.fn();
const clearSessionCookie = vi.fn();
const getSupabaseAdmin = vi.fn();
const getSupabaseAuthClient = vi.fn();

vi.mock("@/lib/auth", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/auth")>();
  return {
    ...actual,
    getCurrentUser,
    setSupabaseSessionCookies,
    clearSessionCookie,
  };
});

vi.mock("@/lib/supabase-server", () => ({
  getSupabaseAdmin,
}));

vi.mock("@/lib/supabase-auth", () => ({
  getSupabaseAuthClient,
}));

describe("auth routes", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("GET /api/auth/me returns the current user", async () => {
    getCurrentUser.mockResolvedValue(approvedUser);
    const { GET } = await import("@/app/api/auth/me/route");
    const response = await GET();
    const body = await response.json();
    expect(body.user).toEqual(approvedUser);
  });

  it("POST /api/auth/logout clears cookies", async () => {
    const { POST } = await import("@/app/api/auth/logout/route");
    const response = await POST();
    expect(response.status).toBe(200);
    expect(clearSessionCookie).toHaveBeenCalled();
  });

  it("POST /api/auth/signup validates email", async () => {
    getSupabaseAdmin.mockReturnValue({ from: vi.fn() });
    const { POST } = await import("@/app/api/auth/signup/route");
    const response = await POST(
      new Request("http://localhost/api/auth/signup", {
        method: "POST",
        body: JSON.stringify({ email: "invalid" }),
      })
    );
    expect(response.status).toBe(400);
  });

  it("POST /api/auth/signup creates pending user", async () => {
    const usersBuilder = createQueryBuilder(async (method) => {
      if (method === "maybeSingle") return { data: null, error: null };
      if (method === "then") return { data: null, error: null };
      return { data: null, error: null };
    });
    usersBuilder.insert = vi.fn(() => usersBuilder);
    getSupabaseAdmin.mockReturnValue({ from: vi.fn(() => usersBuilder) });

    const { POST } = await import("@/app/api/auth/signup/route");
    const response = await POST(
      new Request("http://localhost/api/auth/signup", {
        method: "POST",
        body: JSON.stringify({ email: "new@example.com" }),
      })
    );

    expect(response.status).toBe(200);
    expect(usersBuilder.insert).toHaveBeenCalledWith(
      expect.objectContaining({ email: "new@example.com", status: "pending", role: "user" })
    );
  });

  it("POST /api/auth/login rejects unapproved users", async () => {
    const usersBuilder = createQueryBuilder(async (method) => {
      if (method === "maybeSingle") {
        return { data: { id: "u1", email: "x@example.com", auth_user_id: null, status: "pending" }, error: null };
      }
      return { data: null, error: null };
    });
    getSupabaseAdmin.mockReturnValue({ from: vi.fn(() => usersBuilder) });

    const { POST } = await import("@/app/api/auth/login/route");
    const response = await POST(
      new Request("http://localhost/api/auth/login", {
        method: "POST",
        body: JSON.stringify({ email: "x@example.com", password: "password1234" }),
      })
    );

    expect(response.status).toBe(401);
  });

  it("POST /api/auth/login signs in approved users via getSupabaseAuthClient", async () => {
    const usersBuilder = createQueryBuilder(async (method) => {
      if (method === "maybeSingle") {
        return {
          data: { id: "u1", email: "x@example.com", auth_user_id: "auth-1", status: "approved" },
          error: null,
        };
      }
      return { data: null, error: null };
    });
    getSupabaseAdmin.mockReturnValue({ from: vi.fn(() => usersBuilder) });

    const signInWithPassword = vi.fn().mockResolvedValue({
      data: { session: { access_token: "token", refresh_token: "refresh" } },
      error: null,
    });
    getSupabaseAuthClient.mockReturnValue({ auth: { signInWithPassword } });

    const { POST } = await import("@/app/api/auth/login/route");
    const response = await POST(
      new Request("http://localhost/api/auth/login", {
        method: "POST",
        body: JSON.stringify({ email: "x@example.com", password: "password1234" }),
      })
    );
    const body = await response.json();

    expect(getSupabaseAuthClient).toHaveBeenCalled();
    expect(signInWithPassword).toHaveBeenCalledWith({ email: "x@example.com", password: "password1234" });
    expect(setSupabaseSessionCookies).toHaveBeenCalled();
    expect(body).toEqual({ ok: true });
  });

  it("POST /api/auth/mfa returns 410", async () => {
    const { POST } = await import("@/app/api/auth/mfa/route");
    const response = await POST(new Request("http://localhost/api/auth/mfa", { method: "POST" }));
    expect(response.status).toBe(410);
  });
});
