import { NextResponse } from "next/server";
import { databaseTitle, extractIcon, mapLimit, requireSession, retrieveDatabase } from "@/lib/notion";
import { analyzeSchema, completedTasksFilter, openTasksFilter } from "@/lib/schema";
import { pageToTask, resolveUsers } from "@/lib/tasks";
import type { Task, TaskDatabase } from "@/lib/types";

export const dynamic = "force-dynamic";

const MAX_OPEN_PER_DB = 1000;
const LOGBOOK_PER_DB = 50;

// GET /api/tasks            -> open tasks from every selected database
// GET /api/tasks?logbook=1  -> recently completed tasks
export async function GET(req: Request) {
  const auth = await requireSession();
  if (auth.error) return auth.error;
  const { session, notion } = auth;
  const logbook = new URL(req.url).searchParams.has("logbook");

  const databases: TaskDatabase[] = [];
  const errors: { databaseId: string; message: string }[] = [];
  const pagesByDb: { db: TaskDatabase; schema: ReturnType<typeof analyzeSchema>; pages: any[] }[] = [];

  await mapLimit(session.dbs, 3, async (sel) => {
    try {
      const raw = await retrieveDatabase(notion, session.token, sel.id);
      const schema = analyzeSchema(raw);
      const db: TaskDatabase = {
        id: raw.id,
        name: databaseTitle(raw),
        icon: extractIcon(raw.icon),
        url: raw.url,
        mineOnly: sel.mine && !!schema.assignee,
        hasAssignee: !!schema.assignee,
        statuses: schema.status && schema.status.kind !== "checkbox" ? schema.status.options : [],
      };
      databases.push(db);

      const userFilter = db.mineOnly ? session.userId : undefined;
      const filter = logbook ? completedTasksFilter(schema, userFilter) : openTasksFilter(schema, userFilter);
      if (logbook && !filter) return; // no way to tell what's complete

      const pages: any[] = [];
      let cursor: string | undefined;
      do {
        const res: any = await notion.databases.query({
          database_id: sel.id,
          page_size: 100,
          start_cursor: cursor,
          ...(filter ? { filter } : {}),
          ...(logbook ? { sorts: [{ timestamp: "last_edited_time", direction: "descending" }] } : {}),
        });
        pages.push(...res.results);
        cursor = res.has_more && !logbook && pages.length < MAX_OPEN_PER_DB ? res.next_cursor : undefined;
      } while (cursor);
      pagesByDb.push({ db, schema, pages: logbook ? pages.slice(0, LOGBOOK_PER_DB) : pages });
    } catch (e: any) {
      console.error("Task query failed", sel.id, e?.message);
      errors.push({
        databaseId: sel.id,
        message: e?.code === "object_not_found" ? "This database is no longer shared with the app" : e?.message ?? "Failed to load",
      });
    }
  });

  await resolveUsers(notion, pagesByDb.flatMap((p) => p.pages.map((pg) => pg.created_by?.id).filter(Boolean)));

  const tasks: Task[] = pagesByDb.flatMap(({ db, schema, pages }) =>
    pages.filter((p) => "properties" in p).map((p) => pageToTask(p, schema, db.id)),
  );
  databases.sort((a, b) => session.dbs.findIndex((d) => d.id === a.id) - session.dbs.findIndex((d) => d.id === b.id));

  return NextResponse.json({ databases, tasks, errors });
}

// POST /api/tasks { databaseId, title, due? } -> creates a task assigned to me
export async function POST(req: Request) {
  const auth = await requireSession();
  if (auth.error) return auth.error;
  const { session, notion } = auth;

  const { databaseId, title, due } = (await req.json().catch(() => ({}))) as { databaseId?: string; title?: string; due?: string };
  if (!databaseId || !title?.trim()) {
    return NextResponse.json({ error: "databaseId and title are required" }, { status: 400 });
  }
  if (!session.dbs.some((d) => d.id === databaseId)) {
    return NextResponse.json({ error: "That database isn't selected in Settings" }, { status: 403 });
  }

  try {
    const raw = await retrieveDatabase(notion, session.token, databaseId);
    const schema = analyzeSchema(raw);
    const properties: Record<string, any> = {
      [schema.title]: { title: [{ text: { content: title.trim() } }] },
    };
    if (due && schema.due) properties[schema.due] = { date: { start: due } };
    if (schema.assignee) properties[schema.assignee] = { people: [{ id: session.userId }] };

    const page = await notion.pages.create({ parent: { database_id: databaseId }, properties });
    await resolveUsers(notion, [session.userId]);
    return NextResponse.json(pageToTask(page, schema, raw.id));
  } catch (e: any) {
    console.error("Create task failed", e?.message);
    return NextResponse.json({ error: e?.message ?? "Failed to create task" }, { status: 500 });
  }
}
