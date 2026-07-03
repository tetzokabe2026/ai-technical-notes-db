import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  ACCESS_TOKEN_COOKIE,
  authErrorResponse,
  hashToken,
  isValidPassword,
  isValidUserId,
  randomToken,
} from "@/lib/auth";

describe("auth helpers", () => {
  it("validates user ids", () => {
    expect(isValidUserId("abc")).toBe(true);
    expect(isValidUserId("user.name-1")).toBe(true);
    expect(isValidUserId("ab")).toBe(false);
    expect(isValidUserId("bad id")).toBe(false);
  });

  it("validates password length", () => {
    expect(isValidPassword("1234567890")).toBe(true);
    expect(isValidPassword("short")).toBe(false);
  });

  it("hashes tokens deterministically", () => {
    expect(hashToken("token-a")).toHaveLength(64);
    expect(hashToken("token-a")).toBe(hashToken("token-a"));
    expect(hashToken("token-a")).not.toBe(hashToken("token-b"));
  });

  it("generates random tokens", () => {
    expect(randomToken()).not.toBe(randomToken());
  });

  it("maps auth errors to HTTP responses", async () => {
    const unauthorized = authErrorResponse(new Error("Unauthorized"));
    expect(unauthorized.status).toBe(401);

    const forbidden = authErrorResponse(new Error("Admin access required"));
    expect(forbidden.status).toBe(403);

    const unknown = authErrorResponse(new Error("Database down"));
    expect(unknown.status).toBe(500);
  });
});

describe("session cookies", () => {
  const cookieStore = {
    set: vi.fn(),
    delete: vi.fn(),
    get: vi.fn(),
  };

  beforeEach(() => {
    vi.resetModules();
    cookieStore.set.mockReset();
    cookieStore.delete.mockReset();
    cookieStore.get.mockReset();
    vi.doMock("next/headers", () => ({
      cookies: vi.fn(async () => cookieStore),
    }));
  });

  it("stores access and refresh tokens", async () => {
    const { setSupabaseSessionCookies } = await import("@/lib/auth");
    await setSupabaseSessionCookies({
      access_token: "access-1",
      refresh_token: "refresh-1",
      expires_in: 3600,
    });

    expect(cookieStore.set).toHaveBeenCalledWith(
      ACCESS_TOKEN_COOKIE,
      "access-1",
      expect.objectContaining({ httpOnly: true, maxAge: 3600 })
    );
    expect(cookieStore.set).toHaveBeenCalledWith(
      "sb_refresh_token",
      "refresh-1",
      expect.objectContaining({ maxAge: 60 * 60 * 24 * 14 })
    );
  });

  it("clears session cookies", async () => {
    const { clearSessionCookie } = await import("@/lib/auth");
    await clearSessionCookie();
    expect(cookieStore.delete).toHaveBeenCalledWith(ACCESS_TOKEN_COOKIE);
    expect(cookieStore.delete).toHaveBeenCalledWith("sb_refresh_token");
  });
});

describe("getCurrentUser", () => {
  const cookieStore = {
    set: vi.fn(),
    delete: vi.fn(),
    get: vi.fn(),
  };

  beforeEach(() => {
    vi.resetModules();
    cookieStore.get.mockReset();
    vi.doMock("next/headers", () => ({
      cookies: vi.fn(async () => cookieStore),
    }));
  });

  it("returns null when no access token cookie exists", async () => {
    cookieStore.get.mockReturnValue(undefined);
    const { getCurrentUser } = await import("@/lib/auth");
    await expect(getCurrentUser()).resolves.toBeNull();
  });

  it("returns approved app user when Supabase auth succeeds", async () => {
    cookieStore.get.mockReturnValue({ value: "access-1" });
    vi.doMock("@/lib/supabase-server", () => ({
      getSupabaseAdmin: vi.fn(() => ({
        auth: {
          getUser: vi.fn(async () => ({
            data: { user: { id: "auth-1" } },
            error: null,
          })),
        },
        from: vi.fn(() => ({
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          maybeSingle: vi.fn(async () => ({
            data: {
              id: "user-1",
              auth_user_id: "auth-1",
              email: "user@example.com",
              user_id: "testuser",
              role: "user",
              status: "approved",
            },
            error: null,
          })),
        })),
      })),
    }));

    const { getCurrentUser } = await import("@/lib/auth");
    await expect(getCurrentUser()).resolves.toMatchObject({
      id: "user-1",
      status: "approved",
    });
  });
});
