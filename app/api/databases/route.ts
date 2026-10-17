import { NextResponse } from "next/server";
import { databaseTitle, extractIcon, requireSession } from "@/lib/notion";
import { analyzeSchema } from "@/lib/schema";
import type { AvailableDatabase } from "@/lib/types";

export const dynamic = "force-dynamic";

// Every database the user shared with the app during sign-in, for Settings.
export async function GET() {
  const auth = await requireSession();
  if (auth.error) return auth.error;
  const { session, notion } = auth;

  const found: any[] = [];
  let cursor: string | undefined;
  try {
    do {
      const res: any = await notion.search({
        filter: { property: "object", value: "database" },
        page_size: 100,
        start_cursor: cursor,
      });
      found.push(...res.results);
      cursor = res.has_more ? res.next_cursor : undefined;
    } while (cursor);
  } catch (e: any) {
    if (e?.status === 401) return NextResponse.json({ error: "Notion access was revoked" }, { status: 401 });
    throw e;
  }

  const selected = new Map(session.dbs.map((d) => [d.id, d]));
  const dbs: AvailableDatabase[] = found
    .filter((db) => !db.archived && !db.in_trash)
    .map((db) => {
      const schema = analyzeSchema(db);
      const sel = selected.get(db.id);
      return {
        id: db.id,
        name: databaseTitle(db),
        icon: extractIcon(db.icon),
        url: db.url,
        selected: !!sel,
        mineOnly: sel ? sel.mine : !!schema.assignee,
        hasStatus: !!schema.status,
        hasAssignee: !!schema.assignee,
        hasDue: !!schema.due,
      };
    })
    .sort((a, b) => Number(b.selected) - Number(a.selected) || a.name.localeCompare(b.name));

  return NextResponse.json(dbs);
}
