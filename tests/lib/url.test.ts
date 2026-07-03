import { afterEach, describe, expect, it } from "vitest";
import { getAppOrigin } from "@/lib/url";

describe("getAppOrigin", () => {
  const original = process.env.NEXT_PUBLIC_APP_URL;

  afterEach(() => {
    if (original === undefined) {
      delete process.env.NEXT_PUBLIC_APP_URL;
    } else {
      process.env.NEXT_PUBLIC_APP_URL = original;
    }
  });

  it("prefers NEXT_PUBLIC_APP_URL and strips trailing slash", () => {
    process.env.NEXT_PUBLIC_APP_URL = "https://notes.example.com/";
    expect(getAppOrigin()).toBe("https://notes.example.com");
  });

  it("falls back to request origin", () => {
    delete process.env.NEXT_PUBLIC_APP_URL;
    const request = new Request("https://app.example.com/api/auth/login");
    expect(getAppOrigin(request)).toBe("https://app.example.com");
  });

  it("falls back to localhost", () => {
    delete process.env.NEXT_PUBLIC_APP_URL;
    expect(getAppOrigin()).toBe("http://localhost:3000");
  });
});
