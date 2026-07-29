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

describe("DELETE /api/notes/[id]", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    requireUser.mockResolvedValue(approvedUser);
  });

  it("deletes only the current user's note", async () => {
    const notesBuilder = createQueryBuilder(async () => ({ data: null, error: null }));
    getSupabaseAdmin.mockReturnValue({ from: vi.fn(() => notesBuilder) });

    const { DELETE } = await import("@/app/api/notes/[id]/route");
    const response = await DELETE(new Request("http://localhost/api/notes/note-1"), {
      params: Promise.resolve({ id: "note-1" }),
    });

    expect(response.status).toBe(200);
    expect(notesBuilder.delete).toHaveBeenCalled();
    expect(notesBuilder.eq).toHaveBeenCalledWith("id", "note-1");
    expect(notesBuilder.eq).toHaveBeenCalledWith("owner_user_id", approvedUser.id);
  });
});
