import { NextResponse } from "next/server";
import { requireSession } from "@/lib/notion";
import { dashify, saveSession } from "@/lib/session";

// Saves which databases the user picked and whether each is limited to
// tasks assigned to them.
export async function PUT(req: Request) {
  const auth = await requireSession();
  if (auth.error) return auth.error;

  const body = await req.json().catch(() => null);
  if (!Array.isArray(body?.dbs)) {
    return NextResponse.json({ error: "Expected { dbs: [{ id, mine }] }" }, { status: 400 });
  }
  const dbs = body.dbs
    .filter((d: any) => typeof d?.id === "string" && /^[0-9a-f-]{32,36}$/i.test(d.id))
    .slice(0, 40)
    .map((d: any) => ({ id: dashify(d.id), mine: !!d.mine }));

  await saveSession({ ...auth.session, dbs });
  return NextResponse.json({ ok: true, count: dbs.length });
}
