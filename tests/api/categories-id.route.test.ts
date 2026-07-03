import { beforeEach, describe, expect, it, vi } from "vitest";
import { approvedUser } from "../helpers/auth-fixtures";
import { createQueryBuilder } from "../helpers/supabase-mock";

const requireUser = vi.fn();
const getSupabaseAdmin = vi.fn();

vi.mock("@/lib/auth", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/auth")>();
  return { ...actual, requireUser };
});

vi.mock("@/lib/supabase-server", () => ({
  getSupabaseAdmin,
}));

describe("/api/categories/[id]", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    requireUser.mockResolvedValue(approvedUser);
  });

  it("PATCH updates category name for the owner", async () => {
    const categoriesBuilder = createQueryBuilder(async () => ({ data: null, error: null }));
    getSupabaseAdmin.mockReturnValue({ from: vi.fn(() => categoriesBuilder) });

    const { PATCH } = await import("@/app/api/categories/[id]/route");
    const response = await PATCH(
      new Request("http://localhost/api/categories/cat-1", {
        method: "PATCH",
        body: JSON.stringify({ name: "Updated" }),
      }),
      { params: Promise.resolve({ id: "cat-1" }) }
    );

    expect(response.status).toBe(200);
    expect(categoriesBuilder.update).toHaveBeenCalledWith(expect.objectContaining({ name: "Updated" }));
    expect(categoriesBuilder.eq).toHaveBeenCalledWith("owner_user_id", approvedUser.id);
  });

  it("DELETE removes category for the owner", async () => {
    const categoriesBuilder = createQueryBuilder(async () => ({ data: null, error: null }));
    getSupabaseAdmin.mockReturnValue({ from: vi.fn(() => categoriesBuilder) });

    const { DELETE } = await import("@/app/api/categories/[id]/route");
    const response = await DELETE(new Request("http://localhost/api/categories/cat-1"), {
      params: Promise.resolve({ id: "cat-1" }),
    });

    expect(response.status).toBe(200);
    expect(categoriesBuilder.delete).toHaveBeenCalled();
  });
});
