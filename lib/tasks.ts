import type { Client } from "@notionhq/client";
import { plainText } from "./notion";
import { readStatus, type DbSchema } from "./schema";
import type { Person, PropertyValue, Task } from "./types";

function toPerson(u: any): Person | null {
  if (!u?.id) return null;
  return { id: u.id, name: u.name ?? "Unknown", avatar: u.avatar_url ?? undefined };
}

// Creator names aren't included on pages, so look them up once and cache them
// for the life of the server instance. Requires the integration's
// "Read user information" capability; falls back to no name without it.
const userCache = new Map<string, Person | null>();

export async function resolveUsers(notion: Client, ids: string[]) {
  const missing = Array.from(new Set(ids)).filter((id) => !userCache.has(id));
  await Promise.all(
    missing.map(async (id) => {
      try {
        userCache.set(id, toPerson(await notion.users.retrieve({ user_id: id })));
      } catch {
        userCache.set(id, null);
      }
    }),
  );
}

export function pageToTask(page: any, schema: DbSchema, databaseId: string): Task {
  const props = page.properties ?? {};
  const { status, group } = readStatus(schema, props);
  const assigneeProp = schema.assignee ? props[schema.assignee] : undefined;
  const createdBy = page.created_by?.id;
  return {
    id: page.id,
    title: plainText(props[schema.title]?.title) || "Untitled",
    icon: page.icon?.type === "emoji" ? page.icon.emoji : undefined,
    due: schema.due ? props[schema.due]?.date?.start ?? undefined : undefined,
    status,
    statusGroup: group,
    assignees: (assigneeProp?.people ?? []).map(toPerson).filter(Boolean) as Person[],
    creator: createdBy ? userCache.get(createdBy) ?? undefined : undefined,
    databaseId,
    url: page.url,
    createdTime: page.created_time,
    lastEditedTime: page.last_edited_time,
  };
}

// Renders any Notion property into a small display shape for the detail view.
export function formatProperty(p: any): PropertyValue | null {
  switch (p?.type) {
    case "rich_text": {
      const v = plainText(p.rich_text);
      return v ? { kind: "text", value: v } : null;
    }
    case "number":
      return p.number == null ? null : { kind: "text", value: String(p.number) };
    case "select":
      return p.select ? { kind: "chips", chips: [{ name: p.select.name, color: p.select.color }] } : null;
    case "status":
      return p.status ? { kind: "chips", chips: [{ name: p.status.name, color: p.status.color }] } : null;
    case "multi_select":
      return p.multi_select?.length ? { kind: "chips", chips: p.multi_select.map((o: any) => ({ name: o.name, color: o.color })) } : null;
    case "date":
      return p.date?.start ? { kind: "date", start: p.date.start, end: p.date.end ?? undefined } : null;
    case "people":
      return p.people?.length ? { kind: "people", people: p.people.map(toPerson).filter(Boolean) } : null;
    case "created_by":
    case "last_edited_by": {
      const person = toPerson(p[p.type]);
      return person ? { kind: "people", people: [person] } : null;
    }
    case "checkbox":
      return { kind: "checkbox", value: !!p.checkbox };
    case "url":
      return p.url ? { kind: "url", value: p.url } : null;
    case "email":
      return p.email ? { kind: "text", value: p.email } : null;
    case "phone_number":
      return p.phone_number ? { kind: "text", value: p.phone_number } : null;
    case "relation":
      return p.relation?.length ? { kind: "relation", count: p.relation.length } : null;
    case "formula": {
      const f = p.formula;
      const v = f?.type === "date" ? f.date?.start : f?.[f?.type];
      return v == null || v === "" ? null : { kind: "text", value: String(v) };
    }
    case "rollup": {
      const r = p.rollup;
      if (r?.type === "number" && r.number != null) return { kind: "text", value: String(r.number) };
      if (r?.type === "date" && r.date?.start) return { kind: "date", start: r.date.start };
      return null;
    }
    case "unique_id":
      return p.unique_id?.number != null ? { kind: "text", value: `${p.unique_id.prefix ? p.unique_id.prefix + "-" : ""}${p.unique_id.number}` } : null;
    case "files":
      return p.files?.length ? { kind: "text", value: p.files.map((f: any) => f.name).join(", ") } : null;
    default:
      return null;
  }
}

const TEXT_BLOCKS = ["paragraph", "heading_1", "heading_2", "heading_3", "bulleted_list_item", "numbered_list_item", "to_do", "quote", "callout", "toggle", "code"];

export function blocksToBody(blocks: any[]) {
  return blocks
    .filter((b) => TEXT_BLOCKS.includes(b.type))
    .map((b) => ({
      type: b.type as string,
      text: plainText(b[b.type]?.rich_text),
      checked: b.type === "to_do" ? !!b.to_do?.checked : undefined,
    }))
    .filter((b) => b.text);
}
