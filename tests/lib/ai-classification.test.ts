import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createQueryBuilder } from "../helpers/supabase-mock";

describe("ai-classification", () => {
  beforeEach(() => {
    vi.resetModules();
    process.env.OPENAI_API_KEY = "test-key";
    process.env.OPENAI_MODEL = "gpt-test";
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.clearAllMocks();
  });

  it("suggests metadata for a note", async () => {
    const categoriesBuilder = createQueryBuilder(async (method) => {
      if (method === "then") {
        return {
          data: [
            { id: "cat-1", name: "Tech", parent_id: null },
            { id: "cat-2", name: "Supabase", parent_id: "cat-1" },
          ],
          error: null,
        };
      }
      return { data: null, error: null };
    });

    vi.doMock("@/lib/supabase-server", () => ({
      getSupabaseAdmin: vi.fn(() => ({
        from: vi.fn(() => categoriesBuilder),
      })),
    }));

    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        new Response(
          JSON.stringify({
            output_text: JSON.stringify({
              suggested_title: "Supabase RLS basics",
              suggested_path: ["Tech", "Supabase", "Security"],
              suggested_tags: ["supabase", "rls", "security"],
              confidence: 0.91,
              reason: "Existing Tech/Supabase path fits.",
            }),
          }),
          { status: 200 }
        )
      )
    );

    const { suggestMetadataForNote } = await import("@/lib/ai-classification");
    const result = await suggestMetadataForNote({
      title: "",
      tags: [],
      content: "Row level security in Supabase",
      ownerUserId: "user-1",
    });

    expect(result.suggested_title).toBe("Supabase RLS basics");
    expect(result.suggested_path).toEqual(["Tech", "Supabase", "Security"]);
    expect(result.suggested_tags).toEqual(["supabase", "rls", "security"]);
    expect(result.confidence).toBe(0.91);
  });

  it("creates missing category path segments", async () => {
    const existingCategories = [
      { id: "cat-1", name: "Tech", parent_id: null, owner_user_id: "user-1" },
    ];
    let insertCount = 0;

    const builder = createQueryBuilder(async (method) => {
      if (method === "then") {
        return { data: existingCategories, error: null };
      }
      if (method === "single") {
        insertCount += 1;
        const created = {
          id: `new-${insertCount}`,
          name: insertCount === 1 ? "Supabase" : "Security",
          parent_id: insertCount === 1 ? "cat-1" : "new-1",
          owner_user_id: "user-1",
        };
        existingCategories.push(created);
        return { data: created, error: null };
      }
      return { data: null, error: null };
    });
    builder.insert = vi.fn(() => builder);

    vi.doMock("@/lib/supabase-server", () => ({
      getSupabaseAdmin: vi.fn(() => ({
        from: vi.fn(() => builder),
      })),
    }));

    const { ensureCategoryPathForSuggestion } = await import("@/lib/ai-classification");
    const category = await ensureCategoryPathForSuggestion(["Tech", "Supabase", "Security"], "user-1");

    expect(category.id).toBe("new-2");
    expect(insertCount).toBe(2);
  });

  it("throws when OPENAI_API_KEY is missing", async () => {
    delete process.env.OPENAI_API_KEY;
    vi.doMock("@/lib/supabase-server", () => ({
      getSupabaseAdmin: vi.fn(() => ({
        from: vi.fn(() => createQueryBuilder(async () => ({ data: [], error: null }))),
      })),
    }));

    const { suggestMetadataForNote } = await import("@/lib/ai-classification");
    await expect(
      suggestMetadataForNote({ tags: [], content: "test", ownerUserId: "user-1" })
    ).rejects.toThrow("OPENAI_API_KEY is required.");
  });
});
