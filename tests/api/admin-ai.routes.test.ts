import { beforeEach, describe, expect, it, vi } from "vitest";
import { adminUser } from "../helpers/auth-fixtures";
import { createQueryBuilder } from "../helpers/supabase-mock";

const requireAdmin = vi.fn();
const requireUser = vi.fn();
const getSupabaseAdmin = vi.fn();
const createClassificationRun = vi.fn();
const applyClassificationRun = vi.fn();
const suggestCategoryForNote = vi.fn();

vi.mock("@/lib/auth", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/auth")>();
  return { ...actual, requireAdmin, requireUser };
});

vi.mock("@/lib/supabase-server", () => ({
  getSupabaseAdmin,
}));

vi.mock("@/lib/ai-classification", () => ({
  createClassificationRun,
  applyClassificationRun,
  suggestCategoryForNote,
}));

describe("admin routes", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    requireAdmin.mockResolvedValue(adminUser);
  });

  it("GET /api/admin/users returns users for admins", async () => {
    const usersBuilder = createQueryBuilder(async (method) => {
      if (method === "then") return { data: [{ id: "u1", email: "a@example.com" }], error: null };
      return { data: null, error: null };
    });
    getSupabaseAdmin.mockReturnValue({ from: vi.fn(() => usersBuilder) });

    const { GET } = await import("@/app/api/admin/users/route");
    const response = await GET();
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.users).toHaveLength(1);
  });

  it("GET /api/admin/users rejects non-admin users", async () => {
    requireAdmin.mockRejectedValue(new Error("Admin access required"));
    const { GET } = await import("@/app/api/admin/users/route");
    const response = await GET();
    expect(response.status).toBe(403);
  });
});

describe("ai routes", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    requireUser.mockResolvedValue(adminUser);
  });

  it("POST /api/ai/suggest-category requires content", async () => {
    const { POST } = await import("@/app/api/ai/suggest-category/route");
    const response = await POST(
      new Request("http://localhost/api/ai/suggest-category", {
        method: "POST",
        body: JSON.stringify({ title: "Only title" }),
      })
    );
    expect(response.status).toBe(400);
  });

  it("POST /api/ai/suggest-category returns AI suggestion", async () => {
    suggestCategoryForNote.mockResolvedValue({
      suggested_title: "Title",
      suggested_path: ["Tech"],
      suggested_tags: ["a", "b", "c"],
      existing_category_id: null,
      confidence: 0.8,
      reason: "test",
    });

    const { POST } = await import("@/app/api/ai/suggest-category/route");
    const response = await POST(
      new Request("http://localhost/api/ai/suggest-category", {
        method: "POST",
        body: JSON.stringify({ content: "Some note content" }),
      })
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.suggested_title).toBe("Title");
  });

  it("POST /api/ai/classify-notes delegates to createClassificationRun", async () => {
    createClassificationRun.mockResolvedValue({ run: { id: "run-1" }, classifications: [] });
    const { POST } = await import("@/app/api/ai/classify-notes/route");
    const response = await POST();
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.run.id).toBe("run-1");
    expect(createClassificationRun).toHaveBeenCalledWith(adminUser.id);
  });

  it("POST /api/ai/classification-runs/[id]/apply delegates to applyClassificationRun", async () => {
    applyClassificationRun.mockResolvedValue({ run: { id: "run-1", status: "applied" }, applied_count: 2 });
    const { POST } = await import("@/app/api/ai/classification-runs/[id]/apply/route");
    const response = await POST(new Request("http://localhost/api/ai/classification-runs/run-1/apply"), {
      params: Promise.resolve({ id: "run-1" }),
    });
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.applied_count).toBe(2);
    expect(applyClassificationRun).toHaveBeenCalledWith("run-1", adminUser.id);
  });
});
