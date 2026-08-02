import packageJson from "../package.json";

/** App version from package.json, baked in at build time. */
export const APP_VERSION = packageJson.version;

/**
 * Optional short git SHA from Docker/Jenkins build-arg.
 * Empty in local `next dev` unless NEXT_PUBLIC_GIT_SHA is set.
 */
export const GIT_SHA =
  (typeof process.env.NEXT_PUBLIC_GIT_SHA === "string"
    ? process.env.NEXT_PUBLIC_GIT_SHA.trim()
    : "") || "";

/** Visible build label, e.g. "v1.3.1 · 9c2b6b0". */
export const APP_VERSION_LABEL = [
  APP_VERSION ? `v${APP_VERSION}` : "",
  GIT_SHA ? GIT_SHA.slice(0, 7) : "",
]
  .filter(Boolean)
  .join(" · ");
