export async function POST(request: Request) {
  await request.text();
  return Response.json({ error: "MFA is disabled. Use Supabase Auth email/password login." }, { status: 410 });
}
