export function isDemoMemoryMode(): boolean {
  return process.env.DEMO_SUPABASE_MODE === "memory";
}
