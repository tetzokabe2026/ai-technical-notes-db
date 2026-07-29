import { beforeEach, describe, expect, it, vi } from "vitest";
import { adminUser } from "../helpers/auth-fixtures";
import { createQueryBuilder } from "../helpers/supabase-mock";

const { requireAdmin, randomToken, getSupabaseAdmin } = vi.hoisted(() => ({
  requireAdmin: vi.fn(),
  randomToken: vi.fn(),
  getSupabaseAdmin: vi.fn(),
}));

vi.mock("@/lib/auth", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/auth")>();
  return { ...actual, requireAdmin, randomToken };
});

vi.mock("@/lib/supabase-server", () => ({
  getSupabaseAdmin,
}));

describe("admin user action routes", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    requireAdmin.mockResolvedValue(adminUser);
    randomToken.mockReturnValue("setup-token");
    process.env.NEXT_PUBLIC_APP_URL = "https://notes.example.com";
  });

  it("DELETE /api/admin/users/[id] deletes a user", async () => {
    const usersBuilder = createQueryBuilder(async () => ({ data: null, error: null }));
    getSupabaseAdmin.mockReturnValue({ from: vi.fn(() => usersBuilder) });

    const { DELETE } = await import("@/app/api/admin/users/[id]/route");
    const response = await DELETE(new Request("http://localhost/api/admin/users/user-1"), {
      params: Promise.resolve({ id: "user-1" }),
    });

    expect(response.status).toBe(200);
    expect(usersBuilder.delete).toHaveBeenCalled();
    expect(usersBuilder.eq).toHaveBeenCalledWith("id", "user-1");
  });

  it("POST /api/admin/users/[id]/reject updates status", async () => {
    const usersBuilder = createQueryBuilder(async (method) => {
      if (method === "single") return { data: { email: "user@example.com", auth_user_id: "auth-1" }, error: null };
      return { data: null, error: null };
    });
    getSupabaseAdmin.mockReturnValue({
      from: vi.fn(() => usersBuilder),
      auth: { admin: { updateUserById: vi.fn(async () => ({ error: null })) } },
    });

    const { POST } = await import("@/app/api/admin/users/[id]/reject/route");
    const response = await POST(new Request("http://localhost/api/admin/users/user-1/reject"), {
      params: Promise.resolve({ id: "user-1" }),
    });

    expect(response.status).toBe(200);
    expect(usersBuilder.update).toHaveBeenCalledWith(expect.objectContaining({ status: "rejected" }));
  });

  it("POST /api/admin/users/[id]/approve approves pending user", async () => {
    const usersBuilder = createQueryBuilder(async (method) => {
      if (method === "single") {
        return {
          data: {
            email: "user@example.com",
            auth_user_id: null,
            user_id: null,
            status: "pending",
          },
          error: null,
        };
      }
      return { data: null, error: null };
    });
    usersBuilder.update = vi.fn(() => usersBuilder);
    getSupabaseAdmin.mockReturnValue({
      from: vi.fn(() => usersBuilder),
      auth: {
        admin: {
          inviteUserByEmail: vi.fn(async () => ({ data: { user: { id: "auth-new" } }, error: null })),
          updateUserById: vi.fn(async () => ({ error: null })),
        },
      },
    });

    const { POST } = await import("@/app/api/admin/users/[id]/approve/route");
    const response = await POST(new Request("https://notes.example.com/api/admin/users/user-1/approve"), {
      params: Promise.resolve({ id: "user-1" }),
    });

    expect(response.status).toBe(200);
    expect(usersBuilder.update).toHaveBeenCalledWith(expect.objectContaining({ status: "approved" }));
  });
});
