"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  Check,
  ChevronDown,
  ExternalLink,
  Inbox,
  ListChecks,
  Plus,
  RefreshCw,
  Search,
  Send,
  X,
} from "lucide-react";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type AppView = "assigned" | "delegated" | "inbox";

type Task = {
  id: string;
  title: string;
  due?: string;
  status: string;
  databaseId: string;
  database: string;
  databaseIcon?: string;
  pageIcon?: string;
  isInbox: boolean;
  isAssignedToMe: boolean;
  isCreatedByMe: boolean;
  allAssigneeNames: string[];
  otherAssignees: string[];
  url: string;
  createdTime: string;
  lastEditedTime: string;
};

type TaskDatabase = {
  id: string;
  name: string;
  icon?: string;
  statuses: string[];
  isInbox: boolean;
};

type TaskDetail = {
  page: any;
  blocks: any[];
  bodyText?: string;
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function isValidDate(date: string) {
  const d = new Date(`${date}T00:00:00`);
  return !isNaN(d.getTime());
}

function formatDate(date?: string) {
  if (!date) return "";
  return new Date(`${date}T00:00:00`).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
  });
}

function isDoneStatus(status: string) {
  const s = status.toLowerCase();
  return s.includes("done") || s.includes("complete") || s.includes("finished") || s.includes("closed");
}

function isCancelledStatus(status: string) {
  const s = status.toLowerCase();
  return s.includes("cancel") || s.includes("won't") || s.includes("wont") || s.includes("archive") || s.includes("skip");
}

function isInProgressStatus(status: string) {
  const s = status.toLowerCase();
  return (
    s.includes("progress") || s.includes("active") || s.includes("doing") ||
    (s.includes("started") && !s.includes("not start")) || // exclude "Not Started"
    s.includes("working") || s.includes("ongoing") ||
    s.includes("discussion")
  );
}

// Circle border + fill based on status group
function statusCircleClass(status: string) {
  if (isDoneStatus(status))       return "border-emerald-500 bg-emerald-500";
  if (isCancelledStatus(status))  return "border-zinc-600 bg-zinc-700";
  if (isInProgressStatus(status)) return "border-sky-400 bg-sky-400/40";
  const s = status.toLowerCase();
  if (s.includes("review") || s.includes("reviewing")) return "border-violet-400 bg-violet-400/40";
  // Blocked, stuck, or needs a specific action (meeting, decision, etc.)
  if (s.includes("block") || s.includes("stuck") || s.includes("meeting") || s.includes("needs"))
    return "border-rose-500 bg-rose-500/40";
  // Not started / backlog / tabled / on hold / waiting / someday / later / todo
  return "border-zinc-600 bg-transparent";
}

function isOverdue(due: string) {
  return new Date(`${due}T23:59:59`) < new Date();
}

function sortTasks(tasks: Task[]) {
  return [...tasks].sort((a, b) => {
    const dueA = a.due || "9999-12-31";
    const dueB = b.due || "9999-12-31";
    if (dueA !== dueB) return dueA.localeCompare(dueB);
    return a.title.localeCompare(b.title);
  });
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export default function Home() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [databases, setDatabases] = useState<TaskDatabase[]>([]);
  const [view, setView] = useState<AppView>("assigned");
  const [query, setQuery] = useState("");
  const [showSearch, setShowSearch] = useState(false);
  const [hideDone, setHideDone] = useState(true);
  const [sortBy, setSortBy] = useState<"due" | "status">("due");
  const [selectedDbId, setSelectedDbId] = useState<"all" | string>("all");
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);
  const [composeOpen, setComposeOpen] = useState(false);
  const [composeTitle, setComposeTitle] = useState("");
  const [composeDb, setComposeDb] = useState<string>("");
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [tasksLoading, setTasksLoading] = useState(true);
  const [dbsLoading, setDbsLoading] = useState(true);
  const mainRef = useRef<HTMLDivElement>(null);
  const touchStartY = useRef(0);

  function defaultInboxId(dbs: TaskDatabase[]): string {
    return (
      dbs.find((d) => d.isInbox)?.id ||
      dbs.find((d) => d.name.toLowerCase().includes("inbox"))?.id ||
      dbs[0]?.id ||
      ""
    );
  }

  function doRefresh(showSpinner = false) {
    if (showSpinner) setIsRefreshing(true);
    const t = fetch("/api/tasks")
      .then((r) => r.json())
      .then((data) => {
        if (Array.isArray(data)) {
          setTasks(data);
          try { localStorage.setItem("notion-tasks-cache", JSON.stringify(data)); } catch {}
        }
      })
      .catch(() => {})
      .finally(() => setTasksLoading(false));
    const d = fetch("/api/databases")
      .then((r) => r.json())
      .then((data: TaskDatabase[]) => {
        if (Array.isArray(data)) {
          setDatabases(data);
          try { localStorage.setItem("notion-dbs-cache", JSON.stringify(data)); } catch {}
          setComposeDb(defaultInboxId(data));
        }
      })
      .catch(() => {})
      .finally(() => setDbsLoading(false));
    Promise.all([t, d]).finally(() => setIsRefreshing(false));
  }

  // On mount: load cache immediately, then fetch fresh data in background
  useEffect(() => {
    try {
      const cachedTasks = localStorage.getItem("notion-tasks-cache");
      if (cachedTasks) {
        const parsed = JSON.parse(cachedTasks);
        if (Array.isArray(parsed)) { setTasks(parsed); setTasksLoading(false); }
      }
    } catch {}
    try {
      const cachedDbs = localStorage.getItem("notion-dbs-cache");
      if (cachedDbs) {
        const parsed: TaskDatabase[] = JSON.parse(cachedDbs);
        if (Array.isArray(parsed)) {
          setDatabases(parsed);
          setComposeDb(defaultInboxId(parsed));
          setDbsLoading(false);
        }
      }
    } catch {}
    doRefresh();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Pull-to-refresh touch handling
  useEffect(() => {
    const el = mainRef.current;
    if (!el) return;
    const onStart = (e: TouchEvent) => { touchStartY.current = e.touches[0].clientY; };
    const onEnd = (e: TouchEvent) => {
      if (el.scrollTop > 0) return;
      const delta = e.changedTouches[0].clientY - touchStartY.current;
      if (delta > 80) doRefresh(true);
    };
    el.addEventListener("touchstart", onStart, { passive: true });
    el.addEventListener("touchend", onEnd, { passive: true });
    return () => {
      el.removeEventListener("touchstart", onStart);
      el.removeEventListener("touchend", onEnd);
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const inboxDbs = useMemo(() => databases.filter((d) => d.isInbox), [databases]);
  const inboxTasks = useMemo(
    () => sortTasks(tasks.filter((t) => t.isInbox)),
    [tasks]
  );

  // Tasks assigned to me (excluding inbox DB)
  const assignedTasks = useMemo(
    () => sortTasks(tasks.filter((t) => !t.isInbox && t.isAssignedToMe)),
    [tasks]
  );

  // Tasks I created but are assigned to someone else (or unassigned) — excluding inbox DB
  const delegatedTasks = useMemo(
    () => sortTasks(tasks.filter((t) => !t.isInbox && t.isCreatedByMe && !t.isAssignedToMe)),
    [tasks]
  );

  const visibleTasks = useMemo(() => {
    let base =
      view === "inbox" ? inboxTasks :
      view === "delegated" ? delegatedTasks :
      assignedTasks;

    if (hideDone) {
      base = base.filter((t) => {
        const s = t.status.toLowerCase();
        return !s.includes("done") && !s.includes("complete");
      });
    }
    const filtered =
      selectedDbId === "all"
        ? base
        : base.filter((t) => t.databaseId === selectedDbId);
    const q = query.trim().toLowerCase();
    const searched = !q
      ? filtered
      : filtered.filter((t) =>
          [t.title, t.status, t.database, ...t.otherAssignees]
            .filter(Boolean).join(" ").toLowerCase().includes(q)
        );
    if (sortBy === "status") {
      return [...searched].sort((a, b) =>
        a.status !== b.status ? a.status.localeCompare(b.status) : a.title.localeCompare(b.title)
      );
    }
    return searched;
  }, [tasks, view, selectedDbId, query, hideDone, sortBy, inboxTasks, assignedTasks, delegatedTasks]);

  const nonInboxDbs = useMemo(
    () => databases.filter((d) => !d.isInbox),
    [databases]
  );

  // Optimistically update a task in local state
  function patchLocal(id: string, updates: Partial<Task>) {
    setTasks((prev) =>
      prev.map((t) =>
        t.id === id ? { ...t, ...updates, lastEditedTime: new Date().toISOString() } : t
      )
    );
  }

  async function patchTask(id: string, updates: Partial<Task>) {
    patchLocal(id, updates);
    try {
      await fetch(`/api/tasks/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(updates),
      });
    } catch (err) {
      console.error("Failed to patch task", err);
    }
  }

  async function createTask() {
    const title = composeTitle.trim();
    if (!title || !composeDb) return;
    const db = databases.find((d) => d.id === composeDb);
    const optimisticStatus = db?.statuses[0] || "Not started";

    // Optimistic add
    const tempId = `temp-${Date.now()}`;
    const optimistic: Task = {
      id: tempId,
      title,
      status: optimisticStatus,
      databaseId: composeDb,
      database: db?.name || composeDb.slice(0, 6),
      isInbox: db?.isInbox ?? false,
      isAssignedToMe: true,
      isCreatedByMe: true,
      allAssigneeNames: [],
      otherAssignees: [],
      url: "",
      createdTime: new Date().toISOString(),
      lastEditedTime: new Date().toISOString(),
    };
    setTasks((prev) => [optimistic, ...prev]);
    setComposeTitle("");
    setComposeOpen(false);

    try {
      const res = await fetch("/api/tasks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title, databaseId: composeDb, status: optimisticStatus }),
      });
      if (res.ok) {
        const created = await res.json();
        // Replace temp task with real one
        setTasks((prev) => prev.map((t) => (t.id === tempId ? { ...optimistic, ...created } : t)));
      } else {
        // Roll back
        setTasks((prev) => prev.filter((t) => t.id !== tempId));
      }
    } catch {
      setTasks((prev) => prev.filter((t) => t.id !== tempId));
    }
  }

  const selectedTask = tasks.find((t) => t.id === selectedTaskId) ?? null;

  const loading = tasksLoading || dbsLoading;

  return (
    <div className="min-h-screen bg-zinc-900 text-zinc-50">
      <div className="mx-auto flex min-h-screen max-w-md flex-col border-x border-zinc-800 bg-zinc-900 shadow-2xl">

        {/* ── Header ── */}
        <header className="sticky top-0 z-20 border-b border-zinc-800 bg-zinc-900/95 px-4 pb-3 pt-5 backdrop-blur">
          <div className="flex items-center justify-between">
            <div className="text-lg font-semibold text-zinc-50">Notion Tasks</div>
            <div className="flex items-center gap-1">
              {isRefreshing && <RefreshCw className="h-4 w-4 animate-spin text-zinc-500" />}
              <button
                onClick={() => { setShowSearch((v) => !v); if (showSearch) setQuery(""); }}
                className={`rounded-full border p-2 transition ${showSearch ? "border-sky-400/60 bg-sky-400/10 text-sky-300" : "border-zinc-700 text-zinc-400 hover:bg-zinc-800 hover:text-zinc-100"}`}
              >
                <Search className="h-4 w-4" />
              </button>
            </div>
          </div>

          {/* Nav tabs */}
          <div className="mt-3 grid grid-cols-3 gap-1.5 rounded-2xl bg-zinc-800 p-1">
            <NavTab active={view === "assigned"}   onClick={() => { setView("assigned");   setSelectedDbId("all"); }} icon={ListChecks} label="Assigned" />
            <NavTab active={view === "delegated"}  onClick={() => { setView("delegated");  setSelectedDbId("all"); }} icon={Send}       label="Delegated" />
            <NavTab active={view === "inbox"}      onClick={() => { setView("inbox");      setSelectedDbId("all"); }} icon={Inbox}      label="Inbox" />
          </div>

          {/* Collapsible search */}
          {showSearch && (
            <div className="mt-3 flex items-center gap-2 rounded-2xl border border-zinc-700 bg-zinc-800 px-3 py-2.5">
              <Search className="h-4 w-4 shrink-0 text-zinc-400" />
              <input
                autoFocus
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search tasks…"
                style={{ fontSize: "16px" }}
                className="w-full bg-transparent text-zinc-50 outline-none placeholder:text-zinc-500"
              />
              {query && (
                <button onClick={() => setQuery("")} className="shrink-0 text-zinc-500 hover:text-zinc-300">
                  <X className="h-3.5 w-3.5" />
                </button>
              )}
            </div>
          )}
        </header>

        {/* ── Main content ── */}
        <main ref={mainRef} className="flex-1 overflow-y-auto px-4 pb-24 pt-4">
          {loading ? (
            <LoadingState />
          ) : (
            <>
              {/* DB filter chips */}
              <DatabaseFilter
                selected={selectedDbId}
                databases={view === "inbox" ? inboxDbs : nonInboxDbs}
                onChange={setSelectedDbId}
              />

              {/* Sort + done toolbar */}
              <div className="mb-4 flex items-center justify-between gap-2">
                <div className="flex items-center gap-1">
                  <span className="text-xs text-zinc-500">Sort:</span>
                  <button
                    onClick={() => setSortBy("due")}
                    className={`rounded-full px-2.5 py-1 text-xs transition ${sortBy === "due" ? "bg-zinc-700 text-zinc-100" : "text-zinc-400 hover:text-zinc-200"}`}
                  >
                    Due date
                  </button>
                  <button
                    onClick={() => setSortBy("status")}
                    className={`rounded-full px-2.5 py-1 text-xs transition ${sortBy === "status" ? "bg-zinc-700 text-zinc-100" : "text-zinc-400 hover:text-zinc-200"}`}
                  >
                    Status
                  </button>
                </div>
                <button
                  onClick={() => setHideDone((v) => !v)}
                  className="shrink-0 rounded-full border border-zinc-700 px-2.5 py-1 text-xs text-zinc-400 transition hover:border-zinc-500 hover:text-zinc-200"
                >
                  {hideDone ? "Show done" : "Hide done"}
                </button>
              </div>

              {/* Task list (all views share the same rendering) */}
              {visibleTasks.length === 0 ? (
                <EmptyState
                  title={
                    view === "inbox" ? "Inbox is clear" :
                    view === "delegated" ? "Nothing delegated" :
                    "No tasks found"
                  }
                  subtitle={
                    query ? "Try a different search term." :
                    view === "inbox" ? "Nothing waiting to be sorted." :
                    view === "delegated" ? "No tasks you created are assigned to others." :
                    "Nothing assigned to you right now."
                  }
                />
              ) : (
                <div className="divide-y divide-zinc-800/60">
                  {visibleTasks.map((task) => (
                    <TaskRow
                      key={task.id}
                      task={task}
                      view={view}
                      statuses={databases.find((d) => d.id === task.databaseId)?.statuses ?? [task.status]}
                      onClick={() => setSelectedTaskId(task.id)}
                      onPatch={patchTask}
                    />
                  ))}
                </div>
              )}
            </>
          )}
        </main>

        {/* ── FAB ── */}
        <button
          onClick={() => setComposeOpen(true)}
          className="fixed bottom-6 right-4 z-20 flex h-14 w-14 items-center justify-center rounded-full bg-sky-400 shadow-xl text-zinc-950 transition hover:bg-sky-300 active:scale-95"
        >
          <Plus className="h-6 w-6" />
        </button>

        {/* ── Compose sheet ── */}
        {composeOpen && (
          <ComposeSheet
            title={composeTitle}
            setTitle={setComposeTitle}
            destination={composeDb}
            setDestination={setComposeDb}
            databases={databases}
            onClose={() => setComposeOpen(false)}
            onSubmit={createTask}
          />
        )}

        {/* ── Task detail sheet ── */}
        {selectedTask && (
          <TaskDetailSheet
            task={selectedTask}
            database={databases.find((d) => d.id === selectedTask.databaseId) ?? null}
            onClose={() => setSelectedTaskId(null)}
            onPatch={patchTask}
          />
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function NavTab({
  active,
  onClick,
  icon: Icon,
  label,
}: {
  active: boolean;
  onClick: () => void;
  icon: any;
  label: string;
}) {
  return (
    <button
      onClick={onClick}
      className={`flex items-center justify-center gap-1.5 rounded-xl px-3 py-2 text-sm transition ${
        active ? "bg-sky-400 text-zinc-950 font-medium" : "text-zinc-400 hover:bg-zinc-700 hover:text-zinc-100"
      }`}
    >
      <Icon className="h-4 w-4" />
      <span>{label}</span>
    </button>
  );
}

function DatabaseFilter({
  selected,
  databases,
  onChange,
}: {
  selected: "all" | string;
  databases: TaskDatabase[];
  onChange: (v: "all" | string) => void;
}) {
  if (databases.length === 0) return null;
  return (
    <div className="mb-4 flex gap-2 overflow-x-auto pb-1 [scrollbar-width:none]">
      <FilterChip active={selected === "all"} onClick={() => onChange("all")} label="All DBs" />
      {databases.map((db) => (
        <FilterChip
          key={db.id}
          active={selected === db.id}
          onClick={() => onChange(db.id)}
          label={db.name}
        />
      ))}
    </div>
  );
}

function FilterChip({
  active,
  onClick,
  label,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
}) {
  return (
    <button
      onClick={onClick}
      className={`whitespace-nowrap rounded-full border px-3 py-1.5 text-xs transition ${
        active
          ? "border-sky-400/60 bg-sky-400/10 text-sky-200"
          : "border-zinc-700 text-zinc-400 hover:border-zinc-500 hover:text-zinc-200"
      }`}
    >
      {label}
    </button>
  );
}

function StatusCircle({
  status,
  statuses,
  onStatusChange,
}: {
  status: string;
  statuses: string[];
  onStatusChange: (s: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const done      = isDoneStatus(status);
  const cancelled = isCancelledStatus(status);

  return (
    <div className="relative shrink-0" onClick={(e) => e.stopPropagation()}>
      <button
        onClick={() => setOpen((v) => !v)}
        className={`flex h-5 w-5 items-center justify-center rounded-full border-2 transition active:scale-90 ${statusCircleClass(status)}`}
      >
        {done      && <Check className="h-3 w-3 text-white" strokeWidth={3} />}
        {cancelled && !done && <X className="h-2.5 w-2.5 text-zinc-400" strokeWidth={3} />}
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-30" onClick={() => setOpen(false)} />
          <div className="absolute left-0 top-7 z-40 min-w-[160px] overflow-hidden rounded-xl border border-zinc-700 bg-zinc-800 py-1 shadow-2xl">
            {statuses.map((s) => (
              <button
                key={s}
                onClick={() => { onStatusChange(s); setOpen(false); }}
                className={`flex w-full items-center gap-2.5 px-3 py-2 text-left text-sm transition hover:bg-zinc-700 ${
                  s === status ? "font-medium text-zinc-50" : "text-zinc-400"
                }`}
              >
                <span className={`h-2.5 w-2.5 shrink-0 rounded-full border-2 ${statusCircleClass(s)}`} />
                {s}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

function TaskRow({
  task,
  view,
  statuses,
  onClick,
  onPatch,
}: {
  task: Task;
  view: AppView;
  statuses: string[];
  onClick: () => void;
  onPatch: (id: string, updates: Partial<Task>) => void;
}) {
  const overdue = task.due && isValidDate(task.due) && isOverdue(task.due);
  return (
    <div
      className="flex cursor-pointer items-center gap-3 py-3 transition active:bg-zinc-800/40"
      onClick={onClick}
    >
      <StatusCircle
        status={task.status}
        statuses={statuses}
        onStatusChange={(status) => onPatch(task.id, { status })}
      />
      <span className="min-w-0 flex-1 truncate text-sm text-zinc-100">{task.title}</span>
      <div className="flex shrink-0 items-center gap-2">
        {view === "delegated" && task.otherAssignees.length > 0 && (
          <span className="truncate text-xs text-zinc-500">{task.otherAssignees[0]}</span>
        )}
        {view === "assigned" && task.otherAssignees.length > 0 && (
          <span className="text-xs text-zinc-500">+{task.otherAssignees.length}</span>
        )}
        {task.due && isValidDate(task.due) && (
          <span className={`text-xs ${overdue ? "text-rose-400" : "text-zinc-500"}`}>
            {formatDate(task.due)}
          </span>
        )}
        {(task.isInbox || task.database.toLowerCase().includes("discuss")) && (
          <NotionIcon icon={task.databaseIcon} fallback={getDbFallbackIcon(task.database)} size="sm" />
        )}
      </div>
    </div>
  );
}

function ComposeSheet({
  title,
  setTitle,
  destination,
  setDestination,
  databases,
  onClose,
  onSubmit,
}: {
  title: string;
  setTitle: (v: string) => void;
  destination: string;
  setDestination: (v: string) => void;
  databases: TaskDatabase[];
  onClose: () => void;
  onSubmit: () => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  useEffect(() => { inputRef.current?.focus(); }, []);

  return (
    <div
      className="fixed inset-0 z-40 bg-black/50 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="absolute inset-x-0 bottom-0 rounded-t-3xl border-t border-zinc-700 bg-zinc-900 px-4 pb-10 pt-4 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mx-auto mb-4 h-1.5 w-12 rounded-full bg-zinc-700" />
        <div className="mb-4 text-lg font-semibold text-zinc-50">New task</div>
        <div className="space-y-3">
          <input
            ref={inputRef}
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && onSubmit()}
            placeholder="Task title"
            style={{ fontSize: "16px" }}
            className="w-full rounded-2xl border border-zinc-700 bg-zinc-800 px-4 py-3 text-zinc-50 outline-none placeholder:text-zinc-500 focus:border-zinc-500"
          />
          <div className="relative">
            <select
              value={destination}
              onChange={(e) => setDestination(e.target.value)}
              className="w-full appearance-none rounded-2xl border border-zinc-700 bg-zinc-800 px-4 py-3 text-sm text-zinc-50 outline-none"
            >
              {databases.map((db) => (
                <option key={db.id} value={db.id} className="bg-zinc-900">
                  {getDbFallbackIcon(db.name)} {db.name}
                </option>
              ))}
            </select>
            <ChevronDown className="pointer-events-none absolute right-4 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400" />
          </div>
        </div>
        <div className="mt-4 flex gap-3">
          <button
            onClick={onClose}
            className="flex-1 rounded-2xl border border-zinc-700 px-4 py-3 text-sm text-zinc-300 transition hover:bg-zinc-800"
          >
            Cancel
          </button>
          <button
            onClick={onSubmit}
            disabled={!title.trim()}
            className="flex-1 rounded-2xl bg-sky-400 px-4 py-3 text-sm font-medium text-zinc-950 transition hover:bg-sky-300 disabled:opacity-40"
          >
            Create
          </button>
        </div>
      </div>
    </div>
  );
}

function TaskDetailSheet({
  task,
  database,
  onClose,
  onPatch,
}: {
  task: Task;
  database: TaskDatabase | null;
  onClose: () => void;
  onPatch: (id: string, updates: Partial<Task>) => void;
}) {
  const [detail, setDetail] = useState<TaskDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(true);
  const [editTitle, setEditTitle] = useState(task.title);
  const [editStatus, setEditStatus] = useState(task.status);
  const [editDue, setEditDue] = useState(task.due || "");

  useEffect(() => {
    setDetailLoading(true);
    fetch(`/api/tasks/${task.id}`)
      .then((r) => r.json())
      .then((data) => setDetail(data))
      .catch(() => setDetail(null))
      .finally(() => setDetailLoading(false));
  }, [task.id]);

  // Sync controlled fields if the task prop changes (e.g. after optimistic update)
  useEffect(() => { setEditTitle(task.title); }, [task.title]);
  useEffect(() => { setEditStatus(task.status); }, [task.status]);
  useEffect(() => { setEditDue(task.due || ""); }, [task.due]);

  function handleStatusChange(status: string) {
    setEditStatus(status);
    onPatch(task.id, { status });
  }

  function handleDueChange(due: string) {
    setEditDue(due);
    onPatch(task.id, { due: due || undefined });
  }

  function handleTitleBlur() {
    const trimmed = editTitle.trim();
    if (trimmed && trimmed !== task.title) {
      onPatch(task.id, { title: trimmed });
    }
  }

  const statuses = database?.statuses || [task.status];

  return (
    <div
      className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="absolute inset-x-0 bottom-0 top-10 overflow-hidden rounded-t-3xl border-t border-zinc-700 bg-zinc-900 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Sheet header */}
        <div className="flex items-center justify-between border-b border-zinc-800 px-4 py-3.5">
          <div className="text-sm font-medium text-zinc-400">Task detail</div>
          <div className="flex items-center gap-2">
            {task.url && (
              <a
                href={task.url}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1.5 rounded-full border border-zinc-700 px-3 py-1.5 text-sm text-zinc-200 transition hover:bg-zinc-800"
              >
                <ExternalLink className="h-3.5 w-3.5" />
                Open in Notion
              </a>
            )}
            <button
              onClick={onClose}
              className="rounded-full border border-zinc-700 p-1.5 text-zinc-400 transition hover:bg-zinc-800 hover:text-zinc-100"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* Scrollable body */}
        <div className="h-full overflow-x-hidden overflow-y-auto px-4 pb-12 pt-4">

          {/* Editable title */}
          <div className="rounded-2xl border border-zinc-700 bg-zinc-800/70 px-4 py-3">
            <textarea
              value={editTitle}
              onChange={(e) => {
                setEditTitle(e.target.value);
                const el = e.target;
                el.style.height = "auto";
                el.style.height = el.scrollHeight + "px";
              }}
              onBlur={handleTitleBlur}
              rows={1}
              className="w-full resize-none overflow-hidden bg-transparent text-lg font-semibold text-zinc-50 outline-none"
              style={{ height: "auto" }}
              ref={(el) => {
                if (el) { el.style.height = "auto"; el.style.height = el.scrollHeight + "px"; }
              }}
            />
          </div>

          {/* Editable properties */}
          <div className="mt-3 space-y-3 rounded-2xl border border-zinc-700 bg-zinc-800/70 p-4">
            <PropertyRow label="Database">
              <span className="inline-flex items-center gap-1.5 text-sm text-zinc-300">
                <NotionIcon icon={task.databaseIcon} fallback={getDbFallbackIcon(task.database)} size="sm" />
                {task.database}
              </span>
            </PropertyRow>

            <PropertyRow label="Status">
              {statuses.length > 1 ? (
                <div className="relative">
                  <select
                    value={editStatus}
                    onChange={(e) => handleStatusChange(e.target.value)}
                    className="w-full appearance-none rounded-xl border border-zinc-700 bg-zinc-900 px-3 py-2.5 pr-8 text-sm text-zinc-50 outline-none"
                  >
                    {statuses.map((s) => (
                      <option key={s} value={s} className="bg-zinc-900">
                        {s}
                      </option>
                    ))}
                  </select>
                  <ChevronDown className="pointer-events-none absolute right-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400" />
                </div>
              ) : (
                <span className="text-sm text-zinc-300">{editStatus}</span>
              )}
            </PropertyRow>

            <PropertyRow label="Due date">
              <div className="w-full overflow-hidden">
                <input
                  type="date"
                  value={editDue}
                  onChange={(e) => handleDueChange(e.target.value)}
                  style={{ boxSizing: "border-box" }}
                  className="w-full rounded-xl border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm text-zinc-50 outline-none [color-scheme:dark]"
                />
              </div>
            </PropertyRow>

            {task.allAssigneeNames.length > 0 && (
              <PropertyRow label="Assignee">
                <span className="text-sm text-zinc-300">{task.allAssigneeNames.join(", ")}</span>
              </PropertyRow>
            )}
          </div>

          {/* Page body */}
          <div className="mt-3 rounded-2xl border border-zinc-700 bg-zinc-800/70 p-4">
            <div className="mb-3 text-xs uppercase tracking-[0.18em] text-zinc-500">
              Page body
            </div>
            {detailLoading ? (
              <div className="text-sm text-zinc-500">Loading page content…</div>
            ) : (
              <div className="whitespace-pre-wrap text-sm leading-relaxed text-zinc-300">
                {detail?.bodyText || (
                  <span className="text-zinc-600">No body content on this page.</span>
                )}
              </div>
            )}
          </div>

          {/* Additional Notion properties */}
          {!detailLoading && detail?.page && (
            <div className="mt-3 rounded-2xl border border-zinc-700 bg-zinc-800/70 p-4">
              <div className="mb-3 text-xs uppercase tracking-[0.18em] text-zinc-500">
                All properties
              </div>
              <div className="space-y-2">
                {Object.entries((detail.page as any)?.properties || {})
                  .map(([key, value]: any) => {
                    const pretty = getPropValueDisplay(value);
                    if (!pretty) return null;
                    return (
                      <div key={key} className="flex items-start gap-3 text-sm">
                        <span className="w-28 shrink-0 text-xs text-zinc-500">{key}</span>
                        <span className="min-w-0 break-words text-zinc-300">{pretty}</span>
                      </div>
                    );
                  })
                  .filter(Boolean)}
              </div>
            </div>
          )}

          {/* Timestamps */}
          <div className="mt-3 rounded-2xl border border-zinc-700 bg-zinc-800/70 px-4 py-3 text-xs text-zinc-500">
            <div>Created {new Date(task.createdTime).toLocaleString()}</div>
            <div className="mt-0.5">
              Last edited {new Date(task.lastEditedTime).toLocaleString()}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function PropertyRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="mb-1 text-xs uppercase tracking-[0.18em] text-zinc-500">{label}</div>
      {children}
    </div>
  );
}

function EmptyState({ title, subtitle }: { title: string; subtitle: string }) {
  return (
    <div className="rounded-3xl border border-dashed border-zinc-700 px-4 py-10 text-center">
      <div className="text-sm font-medium text-zinc-300">{title}</div>
      <div className="mt-1 text-sm text-zinc-500">{subtitle}</div>
    </div>
  );
}

function LoadingState() {
  return (
    <div className="space-y-3 pt-2">
      {[...Array(4)].map((_, i) => (
        <div
          key={i}
          className="h-20 animate-pulse rounded-2xl border border-zinc-800 bg-zinc-800/50"
        />
      ))}
    </div>
  );
}

// Emoji fallback icons keyed by database name patterns
function getDbFallbackIcon(name: string): string {
  const n = name.toLowerCase();
  if (n.includes("elt") || n.includes("leader")) return "👥";
  if (n.includes("discuss")) return "💬";
  if (n.includes("inbox")) return "📥";
  return "✅";
}

// Renders a Notion icon — either an emoji or an external image URL
function NotionIcon({ icon, fallback, size = "sm" }: { icon?: string; fallback?: string; size?: "sm" | "md" }) {
  const display = icon || fallback;
  if (!display) return null;
  const dim = size === "md" ? "h-4 w-4" : "h-3 w-3";
  if (display.startsWith("http")) {
    return <img src={display} alt="" className={`${dim} rounded-sm object-cover`} />;
  }
  return <span className={size === "md" ? "text-sm" : "text-xs"}>{display}</span>;
}

// Display-only property value extractor (for the "All properties" section)
function getPropValueDisplay(prop: any): string {
  if (!prop) return "";
  if (prop.type === "status") return prop.status?.name || "";
  if (prop.type === "select") return prop.select?.name || "";
  if (prop.type === "date") return prop.date?.start || "";
  if (prop.type === "people")
    return (prop.people || []).map((p: any) => p.name).filter(Boolean).join(", ");
  if (prop.type === "rich_text")
    return (prop.rich_text || []).map((t: any) => t.plain_text).join("").slice(0, 120);
  if (prop.type === "title")
    return (prop.title || []).map((t: any) => t.plain_text).join("");
  if (prop.type === "number") return prop.number?.toString() || "";
  if (prop.type === "checkbox") return prop.checkbox ? "Yes" : "No";
  if (prop.type === "url") return prop.url || "";
  if (prop.type === "email") return prop.email || "";
  if (prop.type === "phone_number") return prop.phone_number || "";
  if (prop.type === "multi_select")
    return (prop.multi_select || []).map((o: any) => o.name).join(", ");
  if (prop.type === "relation") return `${(prop.relation || []).length} linked`;
  if (prop.type === "formula") return prop.formula?.string || prop.formula?.number?.toString() || "";
  return "";
}
