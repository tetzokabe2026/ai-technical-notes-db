import { beforeEach, describe, expect, it, vi } from "vitest";
import { approvedUser } from "../helpers/auth-fixtures";
import { createQueryBuilder } from "../helpers/supabase-mock";

const requireUser = vi.fn();
const getSupabaseAdmin = vi.fn();
const fetchNoteRatings = vi.fn();

vi.mock("@/lib/auth", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/auth")>();
  return { ...actual, requireUser };
});

vi.mock("@/lib/supabase-server", () => ({
  getSupabaseAdmin,
}));

vi.mock("@/lib/note-rating", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/note-rating")>();
  return { ...actual, fetchNoteRatings };
});

describe("POST /api/notes/[id]/rate", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    requireUser.mockResolvedValue(approvedUser);
  });

  it("rates an unrated note and persists scores", async () => {
    const selectBuilder = createQueryBuilder(async (method) => {
      if (method === "maybeSingle") {
        return {
          data: {
            id: "note-1",
            content: "This content is long enough for the rating API to accept.",
            rating_usefulness: null,
            rating_importance: null,
            rating_credibility: null,
          },
          error: null,
        };
      }
      if (method === "single") {
        return {
          data: {
            id: "note-1",
            rating_usefulness: 4,
            rating_importance: 3,
            rating_credibility: 5,
          },
          error: null,
        };
      }
      return { data: null, error: null };
    });
    selectBuilder.update = vi.fn(() => selectBuilder);

    getSupabaseAdmin.mockReturnValue({ from: vi.fn(() => selectBuilder) });
    fetchNoteRatings.mockResolvedValue({
      ratings: {
        evalId: "eval-1",
        usefulness: 4,
        importance: 3,
        credibility: 5,
      },
    });

    const { POST } = await import("@/app/api/notes/[id]/rate/route");
    const response = await POST(new Request("http://localhost/api/notes/note-1/rate", { method: "POST" }), {
      params: Promise.resolve({ id: "note-1" }),
    });
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.ratingsApplied).toBe(true);
    expect(body.note.rating_usefulness).toBe(4);
    expect(selectBuilder.update).toHaveBeenCalled();
  });
});
