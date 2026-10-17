import { NextResponse } from "next/server";
import { requireSession, retrieveDatabase } from "@/lib/notion";
import { analyzeSchema, statusUpdate } from "@/lib/schema";
import { blocksToBody, formatProperty, pageToTask, resolveUsers } from "@/lib/tasks";
import type { TaskDetail } from "@/lib/types";

export const dynamic = "force-dynamic";

async function loadPage(id: string) {
  const auth = await requireSession();
  if (auth.error) return { error: auth.error };
  const { session, notion } = auth;
  const page: any = await notion.pages.retrieve({ page_id: id });
  const databaseId = page.parent?.database_id;
  if (!databaseId || !session.dbs.some((d) => d.id === databaseId)) {
    return { error: NextResponse.json({ error: "Task isn't in a selected database" }, { status: 403 }) };
  }
  const schema = analyzeSchema(await retrieveDatabase(notion, session.token, databaseId));
  return { session, notion, page, schema, databaseId };
}

export async function GET(_req: Request, { params }: { params: { id: string } }) {
  try {
    const r = await loadPage(params.id);
    if (r.error) return r.error;
    const { notion, page, schema, databaseId } = r;

    const [blocks] = await Promise.all([
      notion.blocks.children.list({ block_id: params.id, page_size: 100 }),
      resolveUsers(notion, [page.created_by?.id].filter(Boolean)),
    ]);

    // Title, status, due and assignee are already on the task itself.
    const shown = new Set([schema.title, schema.status?.name, schema.due, schema.assignee]);
    const properties = Object.entries(page.properties ?? {})
      .filter(([name]) => !shown.has(name))
      .map(([name, p]) => ({ name, value: formatProperty(p) }))
      .filter((p): p is TaskDetail["properties"][number] => p.value !== null)
      .sort((a, b) => a.name.localeCompare(b.name));

    const detail: TaskDetail = {
      task: pageToTask(page, schema, databaseId),
      body: blocksToBody(blocks.results as any[]),
      properties,
    };
    return NextResponse.json(detail);
  } catch (e: any) {
    console.error("Task detail failed", params.id, e?.message);
    return NextResponse.json({ error: e?.message ?? "Failed to load task" }, { status: 500 });
  }
}

// PATCH { title?, due? (null clears), complete?, status? }
export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  try {
    const r = await loadPage(params.id);
    if (r.error) return r.error;
    const { notion, schema, databaseId } = r;
    const body = await req.json().catch(() => ({}));

    const properties: Record<string, any> = {};
    if (typeof body.title === "string" && body.title.trim()) {
      properties[schema.title] = { title: [{ text: { content: body.title.trim() } }] };
    }
    if (body.due !== undefined && schema.due) {
      properties[schema.due] = { date: body.due ? { start: body.due } : null };
    }
    if (typeof body.complete === "boolean" || typeof body.status === "string") {
      const update = statusUpdate(schema, typeof body.status === "string" ? { name: body.status } : { complete: body.complete });
      if (!update) return NextResponse.json({ error: "This database has no status property to update" }, { status: 400 });
      Object.assign(properties, update);
    }
    if (!Object.keys(properties).length) {
      return NextResponse.json({ error: "Nothing to update" }, { status: 400 });
    }

    const page = await notion.pages.update({ page_id: params.id, properties });
    return NextResponse.json(pageToTask(page, schema, databaseId));
  } catch (e: any) {
    console.error("Task update failed", params.id, e?.message);
    return NextResponse.json({ error: e?.message ?? "Failed to update task" }, { status: 500 });
  }
}
