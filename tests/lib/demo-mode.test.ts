import { afterEach, describe, expect, it } from "vitest";

describe("isDemoMemoryMode", () => {
  const env = { ...process.env };

  afterEach(() => {
    process.env = { ...env };
  });

  it("is true only when DEMO_SUPABASE_MODE=memory", async () => {
    process.env.DEMO_SUPABASE_MODE = "memory";
    const { isDemoMemoryMode } = await import("@/lib/demo-mode");
    expect(isDemoMemoryMode()).toBe(true);

    process.env.DEMO_SUPABASE_MODE = "off";
    expect(isDemoMemoryMode()).toBe(false);

    delete process.env.DEMO_SUPABASE_MODE;
    expect(isDemoMemoryMode()).toBe(false);
  });
});
