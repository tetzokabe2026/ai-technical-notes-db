import { afterEach, beforeEach, describe, expect, it } from "vitest";

describe("createDemoMemorySupabase", () => {
  const env = { ...process.env };

  beforeEach(() => {
    process.env.DEMO_ADMIN_EMAIL = "demo@example.com";
    process.env.DEMO_ADMIN_PASSWORD = "demo-password-ok";
  });

  afterEach(async () => {
    process.env = { ...env };
    const { resetDemoMemoryStoreForTests } = await import("@/lib/demo-memory-supabase");
    resetDemoMemoryStoreForTests();
  });

  it("signs in with demo credentials and persists note ratings", async () => {
    const { createDemoMemorySupabase } = await import("@/lib/demo-memory-supabase");
    const client = createDemoMemorySupabase();

    const { data: signIn, error: signInError } = await client.auth.signInWithPassword({
      email: "demo@example.com",
      password: "demo-password-ok",
    });
    expect(signInError).toBeNull();
    expect(signIn.session?.access_token).toBeTruthy();
    expect(signIn.user?.id).toBe("demo-auth-user-id");

    const { data: profile } = await client
      .from("app_users")
      .select("id,email,auth_user_id,status,role")
      .eq("email", "demo@example.com")
      .maybeSingle();
    expect(profile).toMatchObject({
      id: "demo-app-user-id",
      status: "approved",
      role: "admin",
      auth_user_id: "demo-auth-user-id",
    });

    const { data: category } = await client
      .from("categories")
      .select("id,name")
      .eq("name", "Finance")
      .maybeSingle();
    expect(category?.name).toBe("Finance");

    const { data: note, error: insertError } = await client
      .from("technical_notes")
      .insert({
        owner_user_id: "demo-app-user-id",
        title: "Demo note",
        category_id: category!.id,
        tags: ["demo"],
        content: "x".repeat(24),
        source_url: null,
      })
      .select("*, categories(id, name)")
      .single();
    expect(insertError).toBeNull();
    expect(note.title).toBe("Demo note");
    expect(note.categories).toEqual({ id: category!.id, name: "Finance" });

    const { data: rated, error: ratingError } = await client
      .from("technical_notes")
      .update({
        rating_eval_id: "eval-1",
        rating_usefulness: 4,
        rating_importance: 3,
        rating_credibility: 5,
      })
      .eq("id", note.id)
      .eq("owner_user_id", "demo-app-user-id")
      .select("*, categories(id, name)")
      .single();
    expect(ratingError).toBeNull();
    expect(rated).toMatchObject({
      rating_eval_id: "eval-1",
      rating_usefulness: 4,
      rating_importance: 3,
      rating_credibility: 5,
    });

    const { data: userLookup } = await client.auth.getUser(signIn.session!.access_token);
    expect(userLookup.user?.id).toBe("demo-auth-user-id");
  });

  it("rejects wrong password", async () => {
    const { createDemoMemorySupabase } = await import("@/lib/demo-memory-supabase");
    const client = createDemoMemorySupabase();
    const { data, error } = await client.auth.signInWithPassword({
      email: "demo@example.com",
      password: "wrong",
    });
    expect(data.session).toBeNull();
    expect(error?.message).toBeTruthy();
  });
});
