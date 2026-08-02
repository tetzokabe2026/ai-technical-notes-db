import { APP_VERSION, APP_VERSION_LABEL, GIT_SHA } from "@/lib/version";

/** Public deploy fingerprint — no auth. Used to verify Cloud Run is on the expected commit. */
export async function GET() {
  return Response.json(
    {
      version: APP_VERSION,
      gitSha: GIT_SHA || null,
      label: APP_VERSION_LABEL,
    },
    {
      headers: {
        "Cache-Control": "no-store",
      },
    },
  );
}
