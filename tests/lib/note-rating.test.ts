import { afterEach, describe, expect, it, vi } from "vitest";

describe("note-rating", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.resetModules();
    delete process.env.NOTE_RATING_API_URL;
  });

  it("uses default API URL when env is unset", async () => {
    const fetchMock = vi.fn(async () =>
      new Response(
        JSON.stringify({
          "eval-id": "eval-1",
          usefulness: 3,
          importance: 4,
          credibility: 5,
        }),
        { status: 201 },
      ),
    );
    vi.stubGlobal("fetch", fetchMock);

    const { fetchNoteRatings, getRatingApiBaseUrl } = await import("@/lib/note-rating");
    expect(getRatingApiBaseUrl()).toContain("evaluation-mock-api");

    const result = await fetchNoteRatings(
      "This content is long enough to request a rating from the API.",
    );
    expect(result.ratings).toEqual({
      evalId: "eval-1",
      usefulness: 3,
      importance: 4,
      credibility: 5,
    });
    expect(String(fetchMock.mock.calls[0]?.[0])).toMatch(/\/evaluations$/);
  });

  it("strips trailing /evaluations from configured base URL", async () => {
    process.env.NOTE_RATING_API_URL =
      "https://evaluation-mock-api-47730621722.asia-northeast1.run.app/evaluations";
    const fetchMock = vi.fn(async () =>
      new Response(
        JSON.stringify({
          "eval-id": "eval-2",
          usefulness: 2,
          importance: 2,
          credibility: 2,
        }),
        { status: 201 },
      ),
    );
    vi.stubGlobal("fetch", fetchMock);

    const { fetchNoteRatings } = await import("@/lib/note-rating");
    await fetchNoteRatings("This content is long enough to request a rating from the API.");
    expect(String(fetchMock.mock.calls[0]?.[0])).toBe(
      "https://evaluation-mock-api-47730621722.asia-northeast1.run.app/evaluations",
    );
  });

  it("skips when content is too short", async () => {
    const { fetchNoteRatings } = await import("@/lib/note-rating");
    const result = await fetchNoteRatings("too short");
    expect(result).toEqual({ ratings: null, skipReason: "content_too_short" });
  });

  it("accepts numeric scores delivered as strings", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        new Response(
          JSON.stringify({
            "eval-id": "eval-3",
            usefulness: "5",
            importance: "1",
            credibility: "3",
          }),
          { status: 201 },
        ),
      ),
    );

    const { fetchNoteRatings } = await import("@/lib/note-rating");
    const result = await fetchNoteRatings(
      "This content is long enough to request a rating from the API.",
    );
    expect(result.ratings?.usefulness).toBe(5);
    expect(result.ratings?.importance).toBe(1);
    expect(result.ratings?.credibility).toBe(3);
  });
});
