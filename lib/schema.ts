import type { StatusGroup } from "./types";

// Works out which property in an arbitrary Notion database plays each role
// (title, status, due date, assignee), so any task database works without
// hardcoded property names.

export type StatusInfo =
  | {
      kind: "status" | "select";
      name: string;
      options: { name: string; group: StatusGroup }[];
    }
  | { kind: "checkbox"; name: string };

export type DbSchema = {
  title: string;
  status?: StatusInfo;
  due?: string;
  assignee?: string;
};

const DONE_RE = /done|complete|finish|closed|resolved|shipped/i;
const PROGRESS_RE = /progress|doing|active|started|review|working|blocked/i;

function groupFromName(name: string): StatusGroup {
  if (DONE_RE.test(name)) return "complete";
  if (PROGRESS_RE.test(name) && !/not started/i.test(name)) return "in_progress";
  return "todo";
}

function pick(props: [string, any][], type: string, prefer: RegExp) {
  const ofType = props.filter(([, p]) => p.type === type);
  return (ofType.find(([n]) => prefer.test(n)) ?? ofType[0])?.[0];
}

export function analyzeSchema(db: any): DbSchema {
  const props = Object.entries(db.properties ?? {}) as [string, any][];
  const title = props.find(([, p]) => p.type === "title")?.[0] ?? "Name";

  let status: StatusInfo | undefined;
  const statusProp = props.find(([n, p]) => p.type === "status" && /status/i.test(n)) ?? props.find(([, p]) => p.type === "status");
  if (statusProp) {
    const [name, p] = statusProp;
    const groupOf = new Map<string, StatusGroup>();
    for (const g of p.status?.groups ?? []) {
      const gname = String(g.name).toLowerCase();
      const group: StatusGroup = gname.includes("complete") ? "complete" : gname.includes("progress") ? "in_progress" : "todo";
      for (const id of g.option_ids ?? []) groupOf.set(id, group);
    }
    status = {
      kind: "status",
      name,
      options: (p.status?.options ?? []).map((o: any) => ({ name: o.name, group: groupOf.get(o.id) ?? groupFromName(o.name) })),
    };
  } else {
    const sel = props.find(([n, p]) => p.type === "select" && /status|state|stage/i.test(n));
    if (sel) {
      const [name, p] = sel;
      status = {
        kind: "select",
        name,
        options: (p.select?.options ?? []).map((o: any) => ({ name: o.name, group: groupFromName(o.name) })),
      };
    } else {
      const cb = props.find(([n, p]) => p.type === "checkbox" && /done|complete|finished/i.test(n));
      if (cb) status = { kind: "checkbox", name: cb[0] };
    }
  }

  return {
    title,
    status,
    due: pick(props, "date", /due|deadline|date/i),
    assignee: pick(props, "people", /assign|owner|responsible|people|who/i),
  };
}

export function readStatus(schema: DbSchema, props: any): { status?: string; group: StatusGroup } {
  const s = schema.status;
  if (!s) return { group: "todo" };
  const p = props?.[s.name];
  if (s.kind === "checkbox") return { group: p?.checkbox ? "complete" : "todo" };
  const name = s.kind === "status" ? p?.status?.name : p?.select?.name;
  if (!name) return { group: "todo" };
  return { status: name, group: s.options.find((o) => o.name === name)?.group ?? groupFromName(name) };
}

// The property update that marks a task complete (or reopens it).
export function statusUpdate(schema: DbSchema, target: { complete: boolean } | { name: string }) {
  const s = schema.status;
  if (!s) return null;
  if (s.kind === "checkbox") {
    const value = "complete" in target ? target.complete : DONE_RE.test(target.name);
    return { [s.name]: { checkbox: value } };
  }
  let name: string | undefined;
  if ("name" in target) name = target.name;
  else if (target.complete) name = s.options.find((o) => o.group === "complete")?.name;
  else name = s.options.find((o) => o.group === "todo")?.name ?? s.options[0]?.name;
  if (!name) return null;
  return { [s.name]: s.kind === "status" ? { status: { name } } : { select: { name } } };
}

// Server-side filter for open tasks (and optionally only those assigned to me).
export function openTasksFilter(schema: DbSchema, mineOnlyUserId?: string) {
  const and: any[] = [];
  if (mineOnlyUserId && schema.assignee) {
    and.push({ property: schema.assignee, people: { contains: mineOnlyUserId } });
  }
  const s = schema.status;
  if (s?.kind === "checkbox") {
    and.push({ property: s.name, checkbox: { equals: false } });
  } else if (s) {
    for (const o of s.options.filter((o) => o.group === "complete")) {
      and.push({ property: s.name, [s.kind]: { does_not_equal: o.name } });
    }
  }
  return and.length ? { and } : undefined;
}

export function completedTasksFilter(schema: DbSchema, mineOnlyUserId?: string) {
  const s = schema.status;
  if (!s) return null;
  let done: any;
  if (s.kind === "checkbox") done = { property: s.name, checkbox: { equals: true } };
  else {
    const or = s.options.filter((o) => o.group === "complete").map((o) => ({ property: s.name, [s.kind]: { equals: o.name } }));
    if (!or.length) return null;
    done = or.length === 1 ? or[0] : { or };
  }
  if (mineOnlyUserId && schema.assignee) {
    return { and: [{ property: schema.assignee, people: { contains: mineOnlyUserId } }, done] };
  }
  return done;
}
