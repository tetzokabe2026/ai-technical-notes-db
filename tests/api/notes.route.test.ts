import { beforeEach, describe, expect, it, vi } from "vitest";
import { approvedUser } from "../helpers/auth-fixtures";
import { createQueryBuilder } from "../helpers/supabase-mock";

const requireUser = vi.fn();
const getSupabaseAdmin = vi.fn();

vi.mock("@/lib/auth", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/auth")>();
  return {
    ...actual,
    requireUser,
  };
});

vi.mock("@/lib/supabase-server", () => ({
  getSupabaseAdmin,
}));

describe("GET /api/notes", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    requireUser.mockResolvedValue(approvedUser);
  });

  it("returns notes scoped to the current user", async () => {
    const notesBuilder = createQueryBuilder(async (method) => {
      if (method === "then") {
        return {
          data: [{ id: "note-1", title: "Test note", owner_user_id: approvedUser.id }],
          error: null,
        };
      }
      return { data: null, error: null };
    });
    getSupabaseAdmin.mockReturnValue({ from: vi.fn(() => notesBuilder) });

    const { GET } = await import("@/app/api/notes/route");
    const response = await GET(new Request("http://localhost/api/notes"));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.notes).toHaveLength(1);
    expect(notesBuilder.eq).toHaveBeenCalledWith("owner_user_id", approvedUser.id);
  });

  it("returns 401 when unauthenticated", async () => {
    requireUser.mockRejectedValue(new Error("Unauthorized"));
    const { GET } = await import("@/app/api/notes/route");
    const response = await GET(new Request("http://localhost/api/notes"));
    expect(response.status).toBe(401);
  });
});

describe("POST /api/notes", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    requireUser.mockResolvedValue(approvedUser);
  });

  it("validates required fields", async () => {
    getSupabaseAdmin.mockReturnValue({ from: vi.fn() });
    const { POST } = await import("@/app/api/notes/route");
    const response = await POST(
      new Request("http://localhost/api/notes", {
        method: "POST",
        body: JSON.stringify({ title: "Only title" }),
      })
    );
    expect(response.status).toBe(400);
  });

  it("rejects categories owned by another user", async () => {
    const categoriesBuilder = createQueryBuilder(async (method) => {
      if (method === "maybeSingle") return { data: null, error: null };
      return { data: null, error: null };
    });
    getSupabaseAdmin.mockReturnValue({ from: vi.fn(() => categoriesBuilder) });

    const { POST } = await import("@/app/api/notes/route");
    const response = await POST(
      new Request("http://localhost/api/notes", {
        method: "POST",
        body: JSON.stringify({
          title: "Title",
          content: "Body",
          category_id: "other-users-category",
        }),
      })
    );

    expect(response.status).toBe(400);
    const body = await response.json();
    expect(body.error).toBe("Category not found.");
  });

  it("creates a note for the current user", async () => {
    const categoriesBuilder = createQueryBuilder(async (method) => {
      if (method === "maybeSingle") return { data: { id: "cat-1" }, error: null };
      return { data: null, error: null };
    });
    const notesBuilder = createQueryBuilder(async (method) => {
      if (method === "single") {
        return {
          data: {
            id: "note-1",
            title: "Title",
            content: "Body",
            category_id: "cat-1",
            owner_user_id: approvedUser.id,
            categories: { id: "cat-1", name: "Tech" },
          },
          error: null,
        };
      }
      return { data: null, error: null };
    });
    notesBuilder.insert = vi.fn(() => notesBuilder);

    getSupabaseAdmin.mockReturnValue({
      from: vi.fn((table: string) => (table === "categories" ? categoriesBuilder : notesBuilder)),
    });

    const { POST } = await import("@/app/api/notes/route");
    const response = await POST(
      new Request("http://localhost/api/notes", {
        method: "POST",
        body: JSON.stringify({
          title: "Title",
          content: "Body",
          category_id: "cat-1",
          tags: ["a", "b"],
        }),
      })
    );

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.note.title).toBe("Title");
    expect(notesBuilder.insert).toHaveBeenCalledWith(
      expect.objectContaining({ owner_user_id: approvedUser.id, category_id: "cat-1" })
    );
  });
});
