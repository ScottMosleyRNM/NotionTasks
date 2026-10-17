"use client";

import { useEffect, useRef, useState } from "react";
import { Calendar, ExternalLink, Flag, Link2, Loader2 } from "lucide-react";
import { api, dayOnly, daysBetween, friendlyDate, localDateStr, notionAppUrl } from "@/app/lib/client";
import type { PropertyValue, Task, TaskDatabase, TaskDetail } from "@/lib/types";
import { Avatar, AvatarStack, Checkbox, DbIcon, NotionMark } from "./ui";

export type Section = { key: string; header?: React.ReactNode; tasks: Task[] };

type Common = {
  dbs: Map<string, TaskDatabase>;
  meId?: string;
  showDb: boolean;
  hideDue?: boolean;
  completing: Set<string>;
  onToggle: (t: Task) => void;
  onUpdated: (t: Task) => void;
  onError: (msg: string) => void;
};

export function TaskList({ sections, expandedId, onExpand, ...common }: Common & {
  sections: Section[];
  expandedId: string | null;
  onExpand: (id: string | null) => void;
}) {
  return (
    <div className="pb-28">
      {sections.map((s) => (
        <section key={s.key} className="mb-6">
          {s.header}
          <ul>
            {s.tasks.map((t) =>
              t.id === expandedId ? (
                <TaskCard key={t.id} task={t} onClose={() => onExpand(null)} {...common} />
              ) : (
                <TaskRow key={t.id} task={t} onOpen={() => onExpand(t.id)} {...common} />
              ),
            )}
          </ul>
        </section>
      ))}
    </div>
  );
}

export function SectionHeader({ title, icon, count }: { title: string; icon?: React.ReactNode; count?: number }) {
  return (
    <h3 className="mb-1 flex items-center gap-2 border-b border-hairline pb-1.5 text-[15px] font-bold text-ink">
      {icon}
      <span className="truncate">{title}</span>
      {count !== undefined && <span className="ml-auto text-xs font-normal text-muted">{count}</span>}
    </h3>
  );
}

// Things' Upcoming header: a big day number with the weekday beside it.
export function DayHeader({ date, today }: { date: string; today: string }) {
  const d = new Date(`${date}T00:00:00`);
  const diff = daysBetween(today, date);
  const label = diff === 1 ? "Tomorrow" : d.toLocaleDateString(undefined, { weekday: "long" });
  return (
    <h3 className="mb-1 flex items-baseline gap-2 border-b border-hairline pb-1.5">
      <span className="text-[26px] font-bold leading-none tracking-tight">{d.getDate()}</span>
      <span className="text-[15px] font-semibold text-muted">{label}</span>
    </h3>
  );
}

function DueLabel({ due, today }: { due: string; today: string }) {
  const day = dayOnly(due)!;
  const diff = daysBetween(today, day);
  const urgent = diff <= 0;
  let text = friendlyDate(day, today);
  if (diff < -1) text = `${-diff}d ago`;
  return (
    <span className={`flex shrink-0 items-center gap-1 text-[13px] ${urgent ? "font-medium text-things-red" : "text-muted"}`}>
      <Flag className="h-3 w-3" fill={urgent ? "currentColor" : "none"} />
      {text}
    </span>
  );
}

function TaskRow({ task, onOpen, dbs, meId, showDb, hideDue, completing, onToggle }: Common & { task: Task; onOpen: () => void }) {
  const today = localDateStr();
  const db = dbs.get(task.databaseId);
  const done = task.statusGroup === "complete";
  const others = task.assignees.filter((a) => a.id !== meId);
  const fromSomeoneElse = task.creator && task.creator.id !== meId;

  return (
    <li className={completing.has(task.id) ? "task-out" : ""}>
      <div
        role="button"
        tabIndex={0}
        onClick={onOpen}
        onKeyDown={(e) => e.key === "Enter" && onOpen()}
        className="group -mx-3 flex cursor-default items-start gap-3 rounded-lg px-3 py-[7px] outline-none hover:bg-zinc-50 focus-visible:bg-blue-50 active:bg-zinc-100"
      >
        <span className="pt-[2px]">
          <Checkbox checked={done} onToggle={() => onToggle(task)} label={done ? "Mark as not done" : "Mark as done"} />
        </span>
        <span className="min-w-0 flex-1">
          <span className={`block truncate text-[15px] leading-snug ${done ? "text-muted line-through decoration-zinc-300" : ""}`}>
            {task.icon && <span className="mr-1">{task.icon}</span>}
            {task.title}
          </span>
          {(showDb || fromSomeoneElse) && (
            <span className="mt-0.5 flex items-center gap-1.5 truncate text-xs text-muted">
              {showDb && db && (
                <>
                  <DbIcon icon={db.icon} size={12} />
                  <span className="truncate">{db.name}</span>
                </>
              )}
              {showDb && db && fromSomeoneElse && <span>·</span>}
              {fromSomeoneElse && <span className="truncate">from {task.creator!.name.split(" ")[0]}</span>}
            </span>
          )}
        </span>
        <span className="flex items-center gap-2.5 pt-[2px]">
          <AvatarStack people={others} size={18} />
          {!hideDue && task.due && !done && <DueLabel due={task.due} today={today} />}
        </span>
      </div>
    </li>
  );
}

function TaskCard({ task, onClose, dbs, meId, onToggle, onUpdated, onError }: Common & { task: Task; onClose: () => void }) {
  const ref = useRef<HTMLLIElement>(null);
  const [detail, setDetail] = useState<TaskDetail | null>(null);
  const [title, setTitle] = useState(task.title);
  const [saving, setSaving] = useState(false);
  const db = dbs.get(task.databaseId);
  const done = task.statusGroup === "complete";

  useEffect(() => {
    let live = true;
    api<TaskDetail>(`/api/tasks/${task.id}`)
      .then((d) => live && setDetail(d))
      .catch((e) => live && onError(e.message));
    return () => {
      live = false;
    };
  }, [task.id]);

  // Click outside or Escape collapses the card, as in Things.
  const closeRef = useRef(onClose);
  closeRef.current = onClose;
  useEffect(() => {
    const onDown = (e: MouseEvent | TouchEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) closeRef.current();
    };
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && closeRef.current();
    document.addEventListener("mousedown", onDown);
    document.addEventListener("touchstart", onDown);
    document.addEventListener("keydown", onKey);
    ref.current?.scrollIntoView({ block: "nearest", behavior: "smooth" });
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("touchstart", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, []);

  async function patch(body: Record<string, unknown>) {
    setSaving(true);
    try {
      onUpdated(await api<Task>(`/api/tasks/${task.id}`, { method: "PATCH", body: JSON.stringify(body) }));
    } catch (e: any) {
      onError(e.message);
    } finally {
      setSaving(false);
    }
  }

  function saveTitle() {
    const t = title.trim();
    if (t && t !== task.title) patch({ title: t });
    else setTitle(task.title);
  }

  return (
    <li ref={ref} className="card-in relative z-10 -mx-3 my-3 rounded-xl bg-white px-3 pb-3 pt-2.5 shadow-[0_2px_14px_rgba(0,0,0,0.10),0_0_0_1px_rgba(0,0,0,0.04)] md:-mx-4 md:px-4">
      <div className="flex items-start gap-3">
        <span className="pt-[5px]">
          <Checkbox checked={done} onToggle={() => onToggle(task)} label={done ? "Mark as not done" : "Mark as done"} />
        </span>
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          onBlur={saveTitle}
          onKeyDown={(e) => e.key === "Enter" && (e.currentTarget as HTMLInputElement).blur()}
          className="min-w-0 flex-1 bg-transparent py-0.5 text-[16px] font-medium outline-none"
          aria-label="Task title"
        />
        <a
          href={notionAppUrl(task.url)}
          title="Open in the Notion app"
          className="flex shrink-0 items-center gap-1.5 rounded-lg border border-hairline px-2 py-1 text-xs font-medium text-ink hover:bg-zinc-50"
        >
          <NotionMark size={14} />
          <span className="hidden sm:inline">Open</span>
        </a>
        <a href={task.url} target="_blank" rel="noreferrer" title="Open in browser" className="shrink-0 rounded-lg p-1.5 text-muted hover:bg-zinc-50">
          <ExternalLink className="h-3.5 w-3.5" />
        </a>
      </div>

      <div className="pl-[29px]">
        {!detail ? (
          <div className="flex items-center gap-2 py-4 text-sm text-muted">
            <Loader2 className="h-4 w-4 animate-spin" /> Loading…
          </div>
        ) : (
          <>
            {detail.body.length > 0 && (
              <div className="mt-2 max-h-64 space-y-1 overflow-y-auto text-[14px] leading-relaxed text-zinc-600">
                {detail.body.map((b, i) => (
                  <BodyLine key={i} block={b} />
                ))}
              </div>
            )}

            {detail.properties.length > 0 && (
              <dl className="mt-3 grid grid-cols-[minmax(80px,auto)_1fr] gap-x-4 gap-y-1.5 text-[13px]">
                {detail.properties.map((p) => (
                  <div key={p.name} className="contents">
                    <dt className="truncate text-muted">{p.name}</dt>
                    <dd className="min-w-0"><PropValue value={p.value} /></dd>
                  </div>
                ))}
              </dl>
            )}
          </>
        )}

        {/* The basics: database, people, status and due date. */}
        <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-2 border-t border-hairline pt-3 text-[13px] text-muted">
          {db && (
            <span className="flex min-w-0 items-center gap-1.5">
              <DbIcon icon={db.icon} size={14} />
              <span className="truncate text-ink">{db.name}</span>
            </span>
          )}
          {task.assignees.length > 0 && (
            <span className="flex items-center gap-1.5" title="Assignees">
              <AvatarStack people={task.assignees} size={18} max={4} />
              <span className="max-w-[10rem] truncate">
                {task.assignees.map((a) => (a.id === meId ? "Me" : a.name.split(" ")[0])).join(", ")}
              </span>
            </span>
          )}
          {task.creator && (
            <span className="flex items-center gap-1.5" title="Created by">
              <Avatar person={task.creator} size={16} />
              <span>by {task.creator.id === meId ? "me" : task.creator.name}</span>
            </span>
          )}
          {db && db.statuses.length > 0 && (
            <select
              value={task.status ?? ""}
              onChange={(e) => patch({ status: e.target.value })}
              className="rounded-md bg-zinc-100 px-2 py-1 text-[13px] text-ink outline-none"
              aria-label="Status"
            >
              {!task.status && <option value="">No status</option>}
              {db.statuses.map((s) => (
                <option key={s.name} value={s.name}>{s.name}</option>
              ))}
            </select>
          )}
          <label className="ml-auto flex items-center gap-1.5 rounded-md px-1.5 py-1 hover:bg-zinc-50">
            {task.due ? <Flag className="h-3.5 w-3.5 text-things-red" /> : <Calendar className="h-3.5 w-3.5" />}
            <input
              type="date"
              value={dayOnly(task.due) ?? ""}
              onChange={(e) => patch({ due: e.target.value || null })}
              className="bg-transparent text-[13px] text-ink outline-none"
              aria-label="Due date"
            />
          </label>
          {saving && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
        </div>
      </div>
    </li>
  );
}

function BodyLine({ block }: { block: TaskDetail["body"][number] }) {
  switch (block.type) {
    case "heading_1":
    case "heading_2":
    case "heading_3":
      return <p className="pt-1 font-semibold text-ink">{block.text}</p>;
    case "bulleted_list_item":
    case "numbered_list_item":
      return <p className="pl-3">• {block.text}</p>;
    case "to_do":
      return (
        <p className={`flex gap-2 ${block.checked ? "text-muted line-through" : ""}`}>
          <span>{block.checked ? "☑" : "☐"}</span>
          {block.text}
        </p>
      );
    case "quote":
      return <p className="border-l-2 border-zinc-200 pl-3 italic">{block.text}</p>;
    case "code":
      return <pre className="overflow-x-auto rounded bg-zinc-50 p-2 font-mono text-xs">{block.text}</pre>;
    default:
      return <p>{block.text}</p>;
  }
}

const CHIP_COLORS: Record<string, string> = {
  gray: "bg-zinc-100 text-zinc-700", brown: "bg-amber-100/70 text-amber-900", orange: "bg-orange-100 text-orange-800",
  yellow: "bg-yellow-100 text-yellow-800", green: "bg-green-100 text-green-800", blue: "bg-blue-100 text-blue-800",
  purple: "bg-purple-100 text-purple-800", pink: "bg-pink-100 text-pink-800", red: "bg-red-100 text-red-800",
};

function PropValue({ value }: { value: PropertyValue }) {
  switch (value.kind) {
    case "text":
      return <span className="break-words text-ink">{value.value}</span>;
    case "date":
      return <span className="text-ink">{friendlyDate(value.start.slice(0, 10))}{value.end ? ` → ${friendlyDate(value.end.slice(0, 10))}` : ""}</span>;
    case "people":
      return (
        <span className="flex flex-wrap items-center gap-1.5 text-ink">
          {value.people.map((p) => (
            <span key={p.id} className="flex items-center gap-1"><Avatar person={p} size={16} />{p.name}</span>
          ))}
        </span>
      );
    case "chips":
      return (
        <span className="flex flex-wrap gap-1">
          {value.chips.map((c) => (
            <span key={c.name} className={`rounded px-1.5 py-0.5 text-xs ${CHIP_COLORS[c.color?.replace("_background", "") ?? ""] ?? CHIP_COLORS.gray}`}>{c.name}</span>
          ))}
        </span>
      );
    case "checkbox":
      return <span className="text-ink">{value.value ? "Yes" : "No"}</span>;
    case "url":
      return (
        <a href={value.value} target="_blank" rel="noreferrer" className="flex items-center gap-1 truncate text-things-blue">
          <Link2 className="h-3 w-3 shrink-0" /><span className="truncate">{value.value.replace(/^https?:\/\//, "")}</span>
        </a>
      );
    case "relation":
      return <span className="text-ink">{value.count} linked {value.count === 1 ? "page" : "pages"}</span>;
  }
}

export function NewTaskCard({ databases, defaultDbId, defaultDue, onCreate, onCancel }: {
  databases: TaskDatabase[];
  defaultDbId: string;
  defaultDue?: string;
  onCreate: (input: { title: string; databaseId: string; due?: string }) => void;
  onCancel: () => void;
}) {
  const [title, setTitle] = useState("");
  const [dbId, setDbId] = useState(defaultDbId);
  const [due, setDue] = useState(defaultDue ?? "");
  const ref = useRef<HTMLDivElement>(null);

  function submit() {
    if (title.trim()) onCreate({ title: title.trim(), databaseId: dbId, due: due || undefined });
    else onCancel();
  }

  useEffect(() => {
    const onDown = (e: MouseEvent | TouchEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) submit();
    };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("touchstart", onDown);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("touchstart", onDown);
    };
  });

  const db = databases.find((d) => d.id === dbId);
  return (
    <div ref={ref} className="card-in -mx-3 mb-4 rounded-xl bg-white px-3 pb-3 pt-2.5 shadow-[0_2px_14px_rgba(0,0,0,0.10),0_0_0_1px_rgba(0,0,0,0.04)] md:-mx-4 md:px-4">
      <div className="flex items-center gap-3">
        <span className="h-[17px] w-[17px] shrink-0 rounded-[5px] border-[1.5px] border-zinc-300" />
        <input
          autoFocus
          value={title}
          placeholder="New To-Do"
          onChange={(e) => setTitle(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") submit();
            if (e.key === "Escape") onCancel();
          }}
          className="min-w-0 flex-1 bg-transparent py-0.5 text-[16px] font-medium outline-none placeholder:text-faint"
        />
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-3 pl-[29px] text-[13px] text-muted">
        <label className="flex items-center gap-1.5 rounded-md bg-zinc-100 px-2 py-1">
          <DbIcon icon={db?.icon} size={14} />
          <select value={dbId} onChange={(e) => setDbId(e.target.value)} className="max-w-[12rem] bg-transparent text-ink outline-none" aria-label="Database">
            {databases.map((d) => (
              <option key={d.id} value={d.id}>{d.name}</option>
            ))}
          </select>
        </label>
        <label className="flex items-center gap-1.5 rounded-md px-1.5 py-1 hover:bg-zinc-50">
          <Flag className="h-3.5 w-3.5" />
          <input type="date" value={due} onChange={(e) => setDue(e.target.value)} className="bg-transparent text-ink outline-none" aria-label="Due date" />
        </label>
        <button onClick={submit} className="ml-auto rounded-md bg-things-blue px-3 py-1 font-medium text-white">Save</button>
      </div>
    </div>
  );
}
