import { beforeEach, describe, expect, it, vi } from "vitest";
import { approvedUser } from "../helpers/auth-fixtures";

const requireUser = vi.fn();
const ensureCategoryPathForSuggestion = vi.fn();

vi.mock("@/lib/auth", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/auth")>();
  return { ...actual, requireUser };
});

vi.mock("@/lib/ai-classification", () => ({
  ensureCategoryPathForSuggestion,
}));

describe("POST /api/categories/ensure-path", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    requireUser.mockResolvedValue(approvedUser);
    ensureCategoryPathForSuggestion.mockResolvedValue({ id: "cat-leaf", name: "Security" });
  });

  it("requires a non-empty path", async () => {
    const { POST } = await import("@/app/api/categories/ensure-path/route");
    const response = await POST(
      new Request("http://localhost/api/categories/ensure-path", {
        method: "POST",
        body: JSON.stringify({ path: [] }),
      })
    );
    expect(response.status).toBe(400);
  });

  it("returns the leaf category for a valid path", async () => {
    const { POST } = await import("@/app/api/categories/ensure-path/route");
    const response = await POST(
      new Request("http://localhost/api/categories/ensure-path", {
        method: "POST",
        body: JSON.stringify({ path: ["Tech", "Supabase"] }),
      })
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.category.id).toBe("cat-leaf");
    expect(ensureCategoryPathForSuggestion).toHaveBeenCalledWith(["Tech", "Supabase"], approvedUser.id);
  });
});
