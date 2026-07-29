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

describe("/api/categories", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    requireUser.mockResolvedValue(approvedUser);
  });

  it("GET returns categories and note category ids for the user", async () => {
    const categoriesBuilder = createQueryBuilder(async (method) => {
      if (method === "then") return { data: [{ id: "cat-1", name: "Tech" }], error: null };
      return { data: null, error: null };
    });
    const notesBuilder = createQueryBuilder(async (method) => {
      if (method === "then") return { data: [{ category_id: "cat-1" }], error: null };
      return { data: null, error: null };
    });

    getSupabaseAdmin.mockReturnValue({
      from: vi.fn((table: string) => (table === "categories" ? categoriesBuilder : notesBuilder)),
    });

    const { GET } = await import("@/app/api/categories/route");
    const response = await GET();
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.categories).toHaveLength(1);
    expect(body.notes).toEqual([{ category_id: "cat-1" }]);
  });

  it("POST validates category name", async () => {
    getSupabaseAdmin.mockReturnValue({ from: vi.fn() });
    const { POST } = await import("@/app/api/categories/route");
    const response = await POST(
      new Request("http://localhost/api/categories", {
        method: "POST",
        body: JSON.stringify({ name: "   " }),
      })
    );
    expect(response.status).toBe(400);
  });

  it("POST rejects unknown parent category", async () => {
    const categoriesBuilder = createQueryBuilder(async (method) => {
      if (method === "maybeSingle") return { data: null, error: null };
      return { data: null, error: null };
    });
    getSupabaseAdmin.mockReturnValue({ from: vi.fn(() => categoriesBuilder) });

    const { POST } = await import("@/app/api/categories/route");
    const response = await POST(
      new Request("http://localhost/api/categories", {
        method: "POST",
        body: JSON.stringify({ name: "Child", parent_id: "missing-parent" }),
      })
    );

    expect(response.status).toBe(400);
    const body = await response.json();
    expect(body.error).toBe("Parent category not found.");
  });

  it("POST creates a category for the current user", async () => {
    const categoriesBuilder = createQueryBuilder(async (method) => {
      if (method === "single") {
        return { data: { id: "cat-new", name: "Tech", parent_id: null }, error: null };
      }
      return { data: null, error: null };
    });
    categoriesBuilder.insert = vi.fn(() => categoriesBuilder);
    getSupabaseAdmin.mockReturnValue({ from: vi.fn(() => categoriesBuilder) });

    const { POST } = await import("@/app/api/categories/route");
    const response = await POST(
      new Request("http://localhost/api/categories", {
        method: "POST",
        body: JSON.stringify({ name: "Tech" }),
      })
    );

    expect(response.status).toBe(200);
    expect(categoriesBuilder.insert).toHaveBeenCalledWith(
      expect.objectContaining({ owner_user_id: approvedUser.id, name: "Tech" })
    );
  });
});
