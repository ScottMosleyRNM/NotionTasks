"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowUpRight,
  Calendar,
  Check,
  ChevronDown,
  Inbox,
  Layers,
  Plus,
  RefreshCw,
  Search,
  Send,
  Star,
  X,
} from "lucide-react";

// ─── Types ────────────────────────────────────────────────────────────────────

type NavView = "inbox" | "today" | "upcoming" | "anytime" | "delegated" | "source";

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

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getTodayStr() {
  return new Date().toISOString().split("T")[0];
}

function isDoneStatus(s: string) {
  const l = s.toLowerCase();
  return l.includes("done") || l.includes("complete") || l.includes("finish") || l.includes("closed");
}

function isInProgressStatus(s: string) {
  const l = s.toLowerCase();
  return (
    l.includes("progress") || l.includes("active") || l.includes("doing") ||
    (l.includes("started") && !l.includes("not start")) ||
    l.includes("working") || l.includes("ongoing") || l.includes("discussion")
  );
}

function isCancelledStatus(s: string) {
  const l = s.toLowerCase();
  return l.includes("cancel") || l.includes("wont") || l.includes("won't") || l.includes("skip") || l.includes("archive");
}

function isOverdue(due: string, today: string) { return due < today; }
function isToday(due: string, today: string) { return due === today; }

function formatDate(date?: string): string {
  if (!date) return "";
  const d = new Date(`${date}T00:00:00`);
  if (isNaN(d.getTime())) return "";
  const today = getTodayStr();
  if (date === today) return "Today";
  const prev = new Date(today); prev.setDate(prev.getDate() - 1);
  if (date === prev.toISOString().split("T")[0]) return "Yesterday";
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

function formatGroupLabel(date: string): string {
  const d = new Date(`${date}T00:00:00`);
  if (isNaN(d.getTime())) return date;
  const today = new Date(getTodayStr() + "T00:00:00");
  const diff = Math.round((d.getTime() - today.getTime()) / 86400000);
  if (diff === 1) return "Tomorrow";
  if (diff > 1 && diff <= 6) return d.toLocaleDateString(undefined, { weekday: "long" });
  return d.toLocaleDateString(undefined, { month: "long", day: "numeric" });
}

function getPropValueDisplay(prop: any): string {
  if (!prop) return "";
  if (prop.type === "status") return prop.status?.name || "";
  if (prop.type === "select") return prop.select?.name || "";
  if (prop.type === "date") return prop.date?.start || "";
  if (prop.type === "people") return (prop.people || []).map((p: any) => p.name).filter(Boolean).join(", ");
  if (prop.type === "rich_text") return (prop.rich_text || []).map((t: any) => t.plain_text).join("").slice(0, 120);
  if (prop.type === "title") return (prop.title || []).map((t: any) => t.plain_text).join("");
  if (prop.type === "number") return prop.number?.toString() || "";
  if (prop.type === "checkbox") return prop.checkbox ? "Yes" : "No";
  if (prop.type === "url") return prop.url || "";
  if (prop.type === "email") return prop.email || "";
  if (prop.type === "phone_number") return prop.phone_number || "";
  if (prop.type === "multi_select") return (prop.multi_select || []).map((o: any) => o.name).join(", ");
  if (prop.type === "relation") return `${(prop.relation || []).length} linked`;
  if (prop.type === "formula") return prop.formula?.string || prop.formula?.number?.toString() || "";
  return "";
}

// ─── Constants ────────────────────────────────────────────────────────────────

const DB_DOT_COLORS = [
  "bg-blue-400", "bg-emerald-400", "bg-orange-400",
  "bg-purple-400", "bg-rose-400", "bg-indigo-400",
  "bg-amber-500", "bg-teal-400",
];

function getDbDotColor(dbId: string, databases: TaskDatabase[]) {
  const idx = databases.findIndex(d => d.id === dbId);
  return DB_DOT_COLORS[Math.max(0, idx) % DB_DOT_COLORS.length];
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function Home() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [databases, setDatabases] = useState<TaskDatabase[]>([]);
  const [navView, setNavView] = useState<NavView>("today");
  const [dbFilter, setDbFilter] = useState<string | null>(null);
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [showSearch, setShowSearch] = useState(false);
  const [hideDone, setHideDone] = useState(true);
  const [composeOpen, setComposeOpen] = useState(false);
  const [composeTitle, setComposeTitle] = useState("");
  const [composeDb, setComposeDb] = useState("");
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [loading, setLoading] = useState(true);
  const mainRef = useRef<HTMLDivElement>(null);
  const touchStartY = useRef(0);

  function defaultInboxId(dbs: TaskDatabase[]) {
    return dbs.find(d => d.isInbox)?.id || dbs.find(d => d.name.toLowerCase().includes("inbox"))?.id || dbs[0]?.id || "";
  }

  function doRefresh(spinner = false) {
    if (spinner) setIsRefreshing(true);
    const t = fetch("/api/tasks")
      .then(r => r.json())
      .then(data => {
        if (Array.isArray(data)) {
          setTasks(data);
          try { localStorage.setItem("notion-tasks-cache", JSON.stringify(data)); } catch {}
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false));
    const d = fetch("/api/databases")
      .then(r => r.json())
      .then((data: TaskDatabase[]) => {
        if (Array.isArray(data)) {
          setDatabases(data);
          try { localStorage.setItem("notion-dbs-cache", JSON.stringify(data)); } catch {}
          setComposeDb(defaultInboxId(data));
        }
      })
      .catch(() => {});
    Promise.all([t, d]).finally(() => setIsRefreshing(false));
  }

  useEffect(() => {
    try { const c = localStorage.getItem("notion-tasks-cache"); if (c) { const p = JSON.parse(c); if (Array.isArray(p)) { setTasks(p); setLoading(false); } } } catch {}
    try { const c = localStorage.getItem("notion-dbs-cache"); if (c) { const p: TaskDatabase[] = JSON.parse(c); if (Array.isArray(p)) { setDatabases(p); setComposeDb(defaultInboxId(p)); } } } catch {}
    doRefresh();
  }, []); // eslint-disable-line

  // Pull-to-refresh
  useEffect(() => {
    const el = mainRef.current;
    if (!el) return;
    const onStart = (e: TouchEvent) => { touchStartY.current = e.touches[0].clientY; };
    const onEnd = (e: TouchEvent) => {
      if (el.scrollTop > 0) return;
      if (e.changedTouches[0].clientY - touchStartY.current > 80) doRefresh(true);
    };
    el.addEventListener("touchstart", onStart, { passive: true });
    el.addEventListener("touchend", onEnd, { passive: true });
    return () => { el.removeEventListener("touchstart", onStart); el.removeEventListener("touchend", onEnd); };
  }, []); // eslint-disable-line

  // Derived task slices
  const today = getTodayStr();
  const inboxTasks = useMemo(() => tasks.filter(t => t.isInbox), [tasks]);
  const assignedNonInbox = useMemo(() => tasks.filter(t => !t.isInbox && t.isAssignedToMe), [tasks]);
  const nonInboxTasks = useMemo(() => tasks.filter(t => !t.isInbox), [tasks]);
  const delegatedTasks = useMemo(() => tasks.filter(t => !t.isInbox && t.isCreatedByMe && !t.isAssignedToMe), [tasks]);
  const todayTasks = useMemo(() => nonInboxTasks.filter(t => t.due && (isToday(t.due, today) || isOverdue(t.due, today))), [nonInboxTasks, today]);
  const upcomingTasks = useMemo(() => nonInboxTasks.filter(t => t.due && !isToday(t.due, today) && !isOverdue(t.due, today)), [nonInboxTasks, today]);
  const anytimeTasks = useMemo(() => nonInboxTasks.filter(t => !t.due), [nonInboxTasks]);

  const counts = useMemo(() => ({
    inbox: inboxTasks.filter(t => !isDoneStatus(t.status)).length,
    today: todayTasks.filter(t => !isDoneStatus(t.status)).length,
    upcoming: upcomingTasks.filter(t => !isDoneStatus(t.status)).length,
    anytime: anytimeTasks.filter(t => !isDoneStatus(t.status)).length,
    delegated: delegatedTasks.filter(t => !isDoneStatus(t.status)).length,
  }), [inboxTasks, todayTasks, upcomingTasks, anytimeTasks, delegatedTasks]);

  const baseTasks = useMemo(() => {
    switch (navView) {
      case "inbox": return inboxTasks;
      case "today": return todayTasks;
      case "upcoming": return upcomingTasks;
      case "anytime": return anytimeTasks;
      case "delegated": return delegatedTasks;
      case "source": return dbFilter ? tasks.filter(t => t.databaseId === dbFilter) : [];
      default: return assignedNonInbox;
    }
  }, [navView, inboxTasks, todayTasks, upcomingTasks, anytimeTasks, delegatedTasks, assignedNonInbox, tasks, dbFilter]);

  const filteredTasks = useMemo(() => {
    let ts = hideDone ? baseTasks.filter(t => !isDoneStatus(t.status) && !isCancelledStatus(t.status)) : baseTasks;
    // dbFilter already baked into baseTasks for "source" view — only apply for sidebar filter on other views
    if (dbFilter && navView !== "source") ts = ts.filter(t => t.databaseId === dbFilter);
    const q = query.trim().toLowerCase();
    if (q) ts = ts.filter(t => `${t.title} ${t.database} ${t.otherAssignees.join(" ")}`.toLowerCase().includes(q));
    return ts;
  }, [baseTasks, hideDone, dbFilter, navView, query]);

  const taskGroups = useMemo(() => {
    if (navView === "today") {
      const overdue = filteredTasks.filter(t => t.due && isOverdue(t.due, today)).sort((a, b) => a.due!.localeCompare(b.due!));
      const todayItems = filteredTasks.filter(t => !t.due || isToday(t.due, today));
      const groups: { label: string | null; tasks: Task[]; accent?: string }[] = [];
      if (overdue.length) groups.push({ label: "Overdue", tasks: overdue, accent: "text-red-500" });
      if (todayItems.length) groups.push({ label: null, tasks: todayItems });
      return groups.length ? groups : [{ label: null, tasks: [] as Task[] }];
    }
    if (navView === "upcoming") {
      const byDate = new Map<string, Task[]>();
      for (const t of filteredTasks) {
        if (!byDate.has(t.due!)) byDate.set(t.due!, []);
        byDate.get(t.due!)!.push(t);
      }
      return Array.from(byDate.entries())
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([date, tasks]) => ({ label: formatGroupLabel(date), tasks, accent: undefined }));
    }
    if (navView === "source") {
      const sorted = [...filteredTasks].sort((a, b) => {
        const da = a.due || "9999-12-31", db2 = b.due || "9999-12-31";
        return da !== db2 ? da.localeCompare(db2) : a.title.localeCompare(b.title);
      });
      return [{ label: null as string | null, tasks: sorted, accent: undefined }];
    }
    return [{ label: null as string | null, tasks: filteredTasks, accent: undefined }];
  }, [filteredTasks, navView, today]);

  function patchLocal(id: string, updates: Partial<Task>) {
    setTasks(prev => prev.map(t => t.id === id ? { ...t, ...updates, lastEditedTime: new Date().toISOString() } : t));
  }

  async function patchTask(id: string, updates: Partial<Task>) {
    patchLocal(id, updates);
    try {
      await fetch(`/api/tasks/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(updates),
      });
    } catch {}
  }

  async function createTask() {
    const title = composeTitle.trim();
    if (!title || !composeDb) return;
    const db = databases.find(d => d.id === composeDb);
    const optimisticStatus = db?.statuses[0] || "Not started";
    const tempId = `temp-${Date.now()}`;
    const opt: Task = {
      id: tempId, title, status: optimisticStatus,
      databaseId: composeDb, database: db?.name || composeDb.slice(0, 6),
      isInbox: db ? (db.isInbox || db.name.toLowerCase().includes("inbox")) : false,
      isAssignedToMe: true, isCreatedByMe: true,
      allAssigneeNames: [], otherAssignees: [],
      url: "", createdTime: new Date().toISOString(), lastEditedTime: new Date().toISOString(),
    };
    setTasks(prev => [opt, ...prev]);
    setComposeTitle(""); setComposeOpen(false);
    try {
      const res = await fetch("/api/tasks", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title, databaseId: composeDb, status: optimisticStatus }),
      });
      if (res.ok) {
        const created = await res.json();
        setTasks(prev => prev.map(t => t.id === tempId ? { ...opt, ...created } : t));
      } else { setTasks(prev => prev.filter(t => t.id !== tempId)); }
    } catch { setTasks(prev => prev.filter(t => t.id !== tempId)); }
  }

  const selectedTask = tasks.find(t => t.id === selectedTaskId) ?? null;
  const nonInboxDbs = databases.filter(d => !d.isInbox);
  const sourceDbName = dbFilter ? databases.find(d => d.id === dbFilter)?.name ?? "" : "";
  const viewLabel = navView === "source" ? sourceDbName : { inbox: "Inbox", today: "Today", upcoming: "Upcoming", anytime: "Anytime", delegated: "Delegated" }[navView as Exclude<NavView, "source">];

  const navItems: { view: NavView; label: string; mobileIcon: React.ReactNode; sidebarIcon: React.ReactNode }[] = [
    { view: "inbox", label: "Inbox",
      mobileIcon: <Inbox className="h-5 w-5" />,
      sidebarIcon: <NavIcon bg="bg-blue-500"><Inbox className="h-3 w-3 text-white" /></NavIcon> },
    { view: "today", label: "Today",
      mobileIcon: <Star className="h-5 w-5" />,
      sidebarIcon: <NavIcon bg="bg-yellow-400"><Star className="h-3 w-3 text-white fill-white" /></NavIcon> },
    { view: "upcoming", label: "Upcoming",
      mobileIcon: <Calendar className="h-5 w-5" />,
      sidebarIcon: <NavIcon bg="bg-red-400"><Calendar className="h-3 w-3 text-white" /></NavIcon> },
    { view: "anytime", label: "Anytime",
      mobileIcon: <Layers className="h-5 w-5" />,
      sidebarIcon: <NavIcon bg="bg-teal-500"><Layers className="h-3 w-3 text-white" /></NavIcon> },
    { view: "delegated", label: "Delegated",
      mobileIcon: <Send className="h-5 w-5" />,
      sidebarIcon: <NavIcon bg="bg-stone-400"><Send className="h-3 w-3 text-white" /></NavIcon> },
  ];

  return (
    <div className="flex h-[100dvh] bg-white antialiased overflow-hidden text-gray-900">

      {/* ── Desktop Sidebar ── */}
      <aside className="hidden md:flex w-56 shrink-0 flex-col bg-[#F0EDE8] border-r border-[#DDD8D0] overflow-y-auto">
        <div className="pt-10 pb-2 px-3">
          {navItems.map(item => (
            <SidebarNavItem key={item.view} label={item.label} icon={item.sidebarIcon}
              count={counts[item.view]} active={navView === item.view}
              onClick={() => { setNavView(item.view); setDbFilter(null); setQuery(""); }} />
          ))}
        </div>
        {nonInboxDbs.length > 0 && (
          <div className="mt-2 pt-3 border-t border-[#DDD8D0] px-3 pb-4">
            <p className="px-2 mb-1.5 text-[10px] font-semibold uppercase tracking-widest text-[#B0AA9F]">Areas</p>
            {nonInboxDbs.map((db) => (
              <button key={db.id}
                onClick={() => { setNavView("source"); setDbFilter(db.id); setQuery(""); }}
                className={`w-full flex items-center gap-2.5 px-2 py-1.5 rounded-lg text-[13px] transition-colors ${
                  navView === "source" && dbFilter === db.id ? "bg-white shadow-sm text-gray-900 font-medium" : "text-[#4A453D] hover:bg-[#E5E0D8]"
                }`}
              >
                <span className={`w-2 h-2 rounded-full shrink-0 ${getDbDotColor(db.id, databases)}`} />
                <span className="truncate">{db.name}</span>
              </button>
            ))}
          </div>
        )}
        <div className="mt-auto px-5 pb-6">
          {isRefreshing && (
            <div className="flex items-center gap-1.5 text-[11px] text-[#B0AA9F]">
              <RefreshCw className="h-3 w-3 animate-spin" /><span>Syncing…</span>
            </div>
          )}
        </div>
      </aside>

      {/* ── Main content ── */}
      <div className="flex flex-1 flex-col min-w-0">

        {/* Header */}
        <header className="flex-none bg-white px-5 md:px-8 pt-5 md:pt-8 pb-2">
          <div className="flex items-start justify-between gap-4">
            <h1 className="text-[26px] font-bold leading-tight">{viewLabel}</h1>
            <div className="flex items-center gap-1 pt-1">
              {isRefreshing && <RefreshCw className="h-3.5 w-3.5 animate-spin text-stone-400 md:hidden" />}
              <button onClick={() => { setShowSearch(v => !v); if (showSearch) setQuery(""); }}
                className={`p-2 rounded-full transition-colors ${showSearch ? "bg-blue-50 text-blue-500" : "text-stone-400 hover:bg-stone-100"}`}>
                <Search className="h-4 w-4" />
              </button>
              <button onClick={() => doRefresh(true)}
                className="hidden md:flex p-2 rounded-full text-stone-400 hover:bg-stone-100 transition-colors">
                <RefreshCw className="h-4 w-4" />
              </button>
              <button onClick={() => setHideDone(v => !v)}
                className="hidden md:flex items-center px-3 py-1.5 rounded-full text-xs text-stone-500 bg-stone-100 hover:bg-stone-200 transition-colors">
                {hideDone ? "Show done" : "Hide done"}
              </button>
            </div>
          </div>
          {showSearch && (
            <div className="mt-2 flex items-center gap-2 rounded-xl bg-stone-100 px-3 py-2">
              <Search className="h-3.5 w-3.5 shrink-0 text-stone-400" />
              <input autoFocus value={query} onChange={e => setQuery(e.target.value)}
                placeholder="Search tasks…" style={{ fontSize: "16px" }}
                className="flex-1 bg-transparent text-gray-900 outline-none placeholder:text-stone-400 text-sm" />
              {query && <button onClick={() => setQuery("")}><X className="h-3.5 w-3.5 text-stone-400" /></button>}
            </div>
          )}
        </header>

        {/* Task list */}
        <main ref={mainRef} className="flex-1 overflow-y-auto px-5 md:px-8 pb-32 md:pb-8">
          {loading ? <LoadingState /> : filteredTasks.length === 0 ? (
            <EmptyState navView={navView} hasQuery={!!query} sourceName={sourceDbName} />
          ) : (
            <div className="pt-1">
              {taskGroups.map((group, gi) => (
                <div key={gi}>
                  {group.label && (
                    <div className={`flex items-center gap-3 pt-5 pb-1.5 ${group.accent ?? "text-stone-400"}`}>
                      <span className="text-[11px] font-semibold uppercase tracking-widest whitespace-nowrap">{group.label}</span>
                      <div className="flex-1 h-px bg-stone-100" />
                    </div>
                  )}
                  {group.tasks.map(task => (
                    <TaskRow key={task.id} task={task} databases={databases}
                      statuses={databases.find(d => d.id === task.databaseId)?.statuses ?? [task.status]}
                      showDb={navView !== "inbox" && navView !== "source"} today={today}
                      onClick={() => setSelectedTaskId(task.id)} onPatch={patchTask} />
                  ))}
                </div>
              ))}
            </div>
          )}
        </main>
      </div>

      {/* ── Mobile bottom nav ── */}
      <nav className="md:hidden fixed bottom-0 inset-x-0 z-30 bg-white/95 backdrop-blur-md border-t border-stone-200 flex items-center">
        {navItems.map(item => (
          <MobileNavTab key={item.view} icon={item.mobileIcon} label={item.label}
            count={counts[item.view]} active={navView === item.view}
            onClick={() => { setNavView(item.view); setDbFilter(null); setSelectedTaskId(null); }} />
        ))}
      </nav>

      {/* ── FAB ── */}
      <button onClick={() => setComposeOpen(true)}
        className="fixed bottom-[76px] right-4 md:bottom-6 md:right-6 z-20 flex h-14 w-14 md:h-12 md:w-12 items-center justify-center rounded-full bg-blue-500 shadow-lg shadow-blue-500/30 text-white transition-all hover:bg-blue-600 active:scale-95">
        <Plus className="h-6 w-6 md:h-5 md:w-5" />
      </button>

      {composeOpen && (
        <ComposeSheet title={composeTitle} setTitle={setComposeTitle}
          destination={composeDb} setDestination={setComposeDb}
          databases={databases} onClose={() => setComposeOpen(false)} onSubmit={createTask} />
      )}

      {selectedTask && (
        <TaskDetailPanel task={selectedTask}
          database={databases.find(d => d.id === selectedTask.databaseId) ?? null}
          databases={databases} onClose={() => setSelectedTaskId(null)} onPatch={patchTask} />
      )}
    </div>
  );
}

// ─── NavIcon ──────────────────────────────────────────────────────────────────

function NavIcon({ bg, children }: { bg: string; children: React.ReactNode }) {
  return (
    <div className={`w-5 h-5 rounded-[5px] ${bg} flex items-center justify-center shrink-0`}>
      {children}
    </div>
  );
}

// ─── SidebarNavItem ───────────────────────────────────────────────────────────

function SidebarNavItem({ label, icon, count, active, onClick }: {
  label: string; icon: React.ReactNode; count: number; active: boolean; onClick: () => void;
}) {
  return (
    <button onClick={onClick}
      className={`w-full flex items-center gap-2.5 px-2 py-1.5 rounded-lg text-[13px] font-medium transition-colors mb-0.5 ${
        active ? "bg-white shadow-sm text-gray-900" : "text-[#4A453D] hover:bg-[#E5E0D8]"
      }`}>
      {icon}
      <span className="flex-1 text-left">{label}</span>
      {count > 0 && (
        <span className={`text-xs font-semibold tabular-nums ${active ? "text-stone-500" : "text-[#B0AA9F]"}`}>{count}</span>
      )}
    </button>
  );
}

// ─── MobileNavTab ─────────────────────────────────────────────────────────────

function MobileNavTab({ icon, label, count, active, onClick }: {
  icon: React.ReactNode; label: string; count: number; active: boolean; onClick: () => void;
}) {
  return (
    <button onClick={onClick}
      className={`flex flex-1 flex-col items-center gap-0.5 py-2 relative transition-colors ${active ? "text-blue-500" : "text-stone-400"}`}>
      {icon}
      <span className="text-[10px] font-medium">{label}</span>
      {count > 0 && !active && (
        <span className="absolute top-1.5 left-1/2 translate-x-1.5 min-w-[16px] h-4 px-1 rounded-full bg-red-500 text-white text-[10px] font-bold flex items-center justify-center leading-none">
          {count > 99 ? "99+" : count}
        </span>
      )}
    </button>
  );
}

// ─── StatusCircle ─────────────────────────────────────────────────────────────

function StatusCircle({ status, statuses, onStatusChange }: {
  status: string; statuses: string[]; onStatusChange: (s: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const done = isDoneStatus(status);
  const inProgress = !done && isInProgressStatus(status);
  const cancelled = !done && isCancelledStatus(status);

  return (
    <div className="relative shrink-0" onClick={e => e.stopPropagation()}>
      <button onClick={() => setOpen(v => !v)}
        className={`flex h-[22px] w-[22px] items-center justify-center rounded-full border-2 transition-all duration-150 active:scale-90 ${
          done ? "border-stone-300 bg-stone-300" :
          inProgress ? "border-blue-400 bg-blue-50" :
          cancelled ? "border-stone-200 bg-stone-100" :
          "border-stone-300 hover:border-stone-400 bg-white"
        }`}>
        {done && <Check className="h-3 w-3 text-stone-500" strokeWidth={3} />}
        {cancelled && !done && <X className="h-2.5 w-2.5 text-stone-400" strokeWidth={3} />}
        {inProgress && !done && <div className="h-1.5 w-1.5 rounded-full bg-blue-400" />}
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="absolute left-0 top-8 z-50 min-w-[160px] overflow-hidden rounded-xl bg-white border border-stone-200 shadow-xl py-1">
            {statuses.map(s => (
              <button key={s} onClick={() => { onStatusChange(s); setOpen(false); }}
                className={`flex w-full items-center gap-2.5 px-3 py-2 text-left text-sm transition-colors hover:bg-stone-50 ${
                  s === status ? "font-semibold text-gray-900" : "text-stone-600"
                }`}>
                <span className={`h-2.5 w-2.5 shrink-0 rounded-full border-2 ${
                  isDoneStatus(s) ? "border-stone-300 bg-stone-300" :
                  isInProgressStatus(s) ? "border-blue-400 bg-blue-50" :
                  "border-stone-300 bg-white"
                }`} />
                {s}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

// ─── TaskRow ──────────────────────────────────────────────────────────────────

function TaskRow({ task, databases, statuses, showDb, today, onClick, onPatch }: {
  task: Task; databases: TaskDatabase[]; statuses: string[];
  showDb: boolean; today: string;
  onClick: () => void; onPatch: (id: string, updates: Partial<Task>) => void;
}) {
  const done = isDoneStatus(task.status);
  const overdue = task.due && isOverdue(task.due, today) && !done;
  const dueToday = task.due && isToday(task.due, today) && !done;
  const dotColor = showDb ? getDbDotColor(task.databaseId, databases) : null;

  const rowRef = useRef<HTMLDivElement>(null);
  const [swipeX, setSwipeX] = useState(0);
  const swipeState = useRef({ active: false, startX: 0, startY: 0, locked: false });

  useEffect(() => {
    const el = rowRef.current;
    if (!el) return;
    const st = swipeState.current;

    const onStart = (e: TouchEvent) => {
      st.startX = e.touches[0].clientX;
      st.startY = e.touches[0].clientY;
      st.active = true; st.locked = false;
    };
    const onMove = (e: TouchEvent) => {
      if (!st.active || st.locked) return;
      const dx = e.touches[0].clientX - st.startX;
      const dy = e.touches[0].clientY - st.startY;
      if (Math.abs(dy) > Math.abs(dx)) { st.locked = true; return; }
      if (dx > 0) { e.preventDefault(); setSwipeX(Math.min(dx, 80)); }
    };
    const onEnd = () => {
      if (!st.active) return;
      st.active = false;
      setSwipeX(cur => {
        if (cur > 60) {
          const doneStatus = statuses.find(s => isDoneStatus(s)) || "Done";
          onPatch(task.id, { status: doneStatus });
        }
        return 0;
      });
    };

    el.addEventListener("touchstart", onStart, { passive: true });
    el.addEventListener("touchmove", onMove, { passive: false });
    el.addEventListener("touchend", onEnd, { passive: true });
    return () => {
      el.removeEventListener("touchstart", onStart);
      el.removeEventListener("touchmove", onMove);
      el.removeEventListener("touchend", onEnd);
    };
  }, [task.id, statuses, onPatch]);

  return (
    <div ref={rowRef} className="relative overflow-hidden">
      {/* Swipe reveal */}
      <div className="absolute inset-y-0 left-0 flex items-center pl-2 pointer-events-none"
        style={{ opacity: Math.min(1, swipeX / 50) }}>
        <div className="w-8 h-8 rounded-full bg-emerald-100 flex items-center justify-center">
          <Check className="h-4 w-4 text-emerald-600" strokeWidth={2.5} />
        </div>
      </div>
      {/* Content */}
      <div className="flex items-center gap-3 py-2.5 px-1 -mx-1 rounded-lg cursor-pointer hover:bg-stone-50 active:bg-stone-100 transition-colors"
        style={{ transform: `translateX(${swipeX}px)`, transition: swipeX === 0 ? "transform 0.25s ease" : "none" }}
        onClick={onClick}>
        <StatusCircle status={task.status} statuses={statuses}
          onStatusChange={s => onPatch(task.id, { status: s })} />
        <span className={`flex-1 min-w-0 truncate text-[15px] ${done ? "text-stone-400 line-through" : "text-gray-900"}`}>
          {task.title}
        </span>
        <div className="flex items-center gap-2 shrink-0">
          {task.due && (
            <span className={`text-xs font-medium ${
              overdue ? "text-red-500" : dueToday ? "text-amber-600" : "text-stone-400"
            }`}>{formatDate(task.due)}</span>
          )}
          {showDb && dotColor && (
            <span className={`w-2 h-2 rounded-full shrink-0 ${dotColor}`} />
          )}
        </div>
      </div>
    </div>
  );
}

// ─── TaskDetailPanel ──────────────────────────────────────────────────────────

function TaskDetailPanel({ task, database, databases, onClose, onPatch }: {
  task: Task; database: TaskDatabase | null; databases: TaskDatabase[];
  onClose: () => void; onPatch: (id: string, updates: Partial<Task>) => void;
}) {
  const [detail, setDetail] = useState<TaskDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(true);
  const [editTitle, setEditTitle] = useState(task.title);
  const [editStatus, setEditStatus] = useState(task.status);
  const [editDue, setEditDue] = useState(task.due || "");
  const [propsExpanded, setPropsExpanded] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => { requestAnimationFrame(() => setMounted(true)); }, []);

  useEffect(() => {
    setDetailLoading(true);
    fetch(`/api/tasks/${task.id}`)
      .then(r => r.json()).then(d => setDetail(d))
      .catch(() => setDetail(null)).finally(() => setDetailLoading(false));
  }, [task.id]);

  useEffect(() => { setEditTitle(task.title); }, [task.title]);
  useEffect(() => { setEditStatus(task.status); }, [task.status]);
  useEffect(() => { setEditDue(task.due || ""); }, [task.due]);

  function handleStatusChange(s: string) { setEditStatus(s); onPatch(task.id, { status: s }); }
  function handleDueChange(d: string) { setEditDue(d); onPatch(task.id, { due: d || undefined }); }
  function handleTitleBlur() {
    const t = editTitle.trim();
    if (t && t !== task.title) onPatch(task.id, { title: t });
  }

  const statuses = database?.statuses || [task.status];
  const dotColor = getDbDotColor(task.databaseId, databases);
  const allProps = Object.entries((detail?.page as any)?.properties || {})
    .map(([key, value]: any) => ({ key, value: getPropValueDisplay(value) }))
    .filter(p => p.value);

  return (
    <>
      {/* Backdrop */}
      <div className="fixed inset-0 z-40 bg-black/30 backdrop-blur-sm"
        style={{ opacity: mounted ? 1 : 0, transition: "opacity 0.25s" }}
        onClick={onClose} />

      {/* Modal wrapper — bottom sheet on mobile, centered card on desktop */}
      <div className="fixed inset-0 z-50 flex items-end md:items-center justify-center md:p-6 pointer-events-none">
        <div className="pointer-events-auto bg-white shadow-2xl flex flex-col
          w-full rounded-t-2xl max-h-[92dvh]
          md:rounded-2xl md:max-h-[85vh] md:w-full md:max-w-lg"
          style={{ transform: mounted ? "none" : "translateY(40px)", opacity: mounted ? 1 : 0, transition: "transform 0.35s cubic-bezier(0.32,0.72,0,1), opacity 0.25s" }}>

          {/* Mobile drag handle */}
          <div className="md:hidden flex justify-center pt-2.5 pb-1 shrink-0">
            <div className="w-10 h-1 rounded-full bg-stone-300" />
          </div>

          {/* Header — just close button */}
          <div className="flex items-center justify-end px-4 py-2 shrink-0">
            <button onClick={onClose}
              className="p-1.5 rounded-full hover:bg-stone-100 text-stone-400 hover:text-stone-600 transition-colors">
              <X className="h-4 w-4" />
            </button>
          </div>

          {/* Body */}
          <div className="flex-1 overflow-y-auto px-5 pb-6 pt-1">
            <textarea value={editTitle}
              onChange={e => { setEditTitle(e.target.value); const el = e.target; el.style.height = "auto"; el.style.height = el.scrollHeight + "px"; }}
              onBlur={handleTitleBlur} rows={1}
              className="w-full resize-none overflow-hidden bg-transparent text-[20px] font-bold text-gray-900 outline-none leading-snug"
              ref={el => { if (el) { el.style.height = "auto"; el.style.height = el.scrollHeight + "px"; } }} />

            <div className="flex items-center gap-1.5 mt-1.5 mb-4">
              <span className={`w-2 h-2 rounded-full shrink-0 ${dotColor}`} />
              <span className="text-sm text-stone-500">{task.database}</span>
            </div>

            <div className="divide-y divide-stone-100">
              <div className="flex items-center gap-3 py-2.5">
                <span className="text-sm text-stone-400 w-20 shrink-0">Status</span>
                {statuses.length > 1 ? (
                  <div className="relative flex-1">
                    <select value={editStatus} onChange={e => handleStatusChange(e.target.value)}
                      className="w-full appearance-none bg-transparent text-sm text-gray-900 outline-none cursor-pointer pr-5">
                      {statuses.map(s => <option key={s} value={s}>{s}</option>)}
                    </select>
                    <ChevronDown className="pointer-events-none absolute right-0 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-stone-400" />
                  </div>
                ) : <span className="text-sm text-gray-900">{editStatus}</span>}
              </div>

              <div className="flex items-center gap-3 py-2.5">
                <span className="text-sm text-stone-400 w-20 shrink-0">Due date</span>
                <input type="date" value={editDue} onChange={e => handleDueChange(e.target.value)}
                  className="flex-1 bg-transparent text-sm text-gray-900 outline-none [color-scheme:light]" />
              </div>

              {task.allAssigneeNames.length > 0 && (
                <div className="flex items-center gap-3 py-2.5">
                  <span className="text-sm text-stone-400 w-20 shrink-0">Assignees</span>
                  <span className="text-sm text-gray-900">{task.allAssigneeNames.join(", ")}</span>
                </div>
              )}
            </div>

            <div className="mt-5">
              <p className="text-xs font-semibold uppercase tracking-widest text-stone-400 mb-2">Notes</p>
              {detailLoading ? (
                <div className="space-y-2">
                  <div className="h-3 bg-stone-100 animate-pulse rounded w-3/4" />
                  <div className="h-3 bg-stone-100 animate-pulse rounded w-1/2" />
                </div>
              ) : detail?.bodyText ? (
                <p className="text-sm text-stone-600 leading-relaxed whitespace-pre-wrap">{detail.bodyText}</p>
              ) : (
                <p className="text-sm text-stone-300 italic">No notes on this page.</p>
              )}
            </div>

            {!detailLoading && allProps.length > 0 && (
              <div className="mt-5">
                <button onClick={() => setPropsExpanded(v => !v)}
                  className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-widest text-stone-400 hover:text-stone-600 transition-colors">
                  <ChevronDown className={`h-3 w-3 transition-transform duration-200 ${propsExpanded ? "rotate-180" : ""}`} />
                  All properties
                </button>
                {propsExpanded && (
                  <div className="mt-2.5 space-y-2">
                    {allProps.map(({ key, value }) => (
                      <div key={key} className="flex items-start gap-3 text-sm">
                        <span className="w-24 shrink-0 text-xs text-stone-400">{key}</span>
                        <span className="min-w-0 text-stone-600 break-words">{value}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Timestamps + subtle Notion link */}
            <div className="mt-6 pt-4 border-t border-stone-100 flex items-end justify-between">
              <div className="text-xs text-stone-300 space-y-0.5">
                <div>Created {new Date(task.createdTime).toLocaleString()}</div>
                <div>Edited {new Date(task.lastEditedTime).toLocaleString()}</div>
              </div>
              {task.url && (
                <a href={task.url} target="_blank" rel="noreferrer"
                  className="flex items-center gap-1 text-xs text-stone-300 hover:text-stone-500 transition-colors"
                  title="Open in Notion">
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M4.459 4.208c.746.606 1.026.56 2.428.466l13.215-.793c.28 0 .047-.28-.046-.326L17.86 1.968c-.42-.326-.981-.7-2.055-.607L3.01 2.295c-.466.046-.56.28-.374.466zm.793 3.08v13.904c0 .747.373 1.027 1.214.98l14.523-.84c.841-.046.935-.56.935-1.167V6.354c0-.606-.233-.933-.748-.887l-15.177.887c-.56.047-.747.327-.747.933zm14.337.745c.093.42 0 .84-.42.888l-.7.14v10.264c-.608.327-1.168.514-1.635.514-.748 0-.935-.234-1.495-.933l-4.577-7.186v6.952L12.21 19s0 .84-1.168.84l-3.222.186c-.093-.186 0-.653.327-.746l.84-.233V9.854L7.822 9.76c-.094-.42.14-1.026.793-1.073l3.456-.233 4.764 7.279v-6.44l-1.215-.14c-.093-.514.28-.887.747-.933zM1.936 1.035l13.31-.98c1.634-.14 2.055-.047 3.082.7l4.249 2.986c.7.513.934.653.934 1.213v16.378c0 1.026-.373 1.634-1.68 1.726l-15.458.934c-.98.047-1.448-.093-1.962-.747l-3.129-4.06c-.56-.747-.793-1.306-.793-1.96V2.667c0-.839.374-1.54 1.447-1.632z"/>
                  </svg>
                  <span>Notion</span>
                </a>
              )}
            </div>
          </div>
        </div>
      </div>
    </>
  );
}

// ─── ComposeSheet ─────────────────────────────────────────────────────────────

function ComposeSheet({ title, setTitle, destination, setDestination, databases, onClose, onSubmit }: {
  title: string; setTitle: (v: string) => void;
  destination: string; setDestination: (v: string) => void;
  databases: TaskDatabase[]; onClose: () => void; onSubmit: () => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [keyboardOffset, setKeyboardOffset] = useState(0);
  const [mounted, setMounted] = useState(false);

  useEffect(() => { requestAnimationFrame(() => setMounted(true)); inputRef.current?.focus(); }, []);

  useEffect(() => {
    const vv = window.visualViewport;
    if (!vv) return;
    const update = () => setKeyboardOffset(Math.max(0, window.innerHeight - vv.height - vv.offsetTop));
    vv.addEventListener("resize", update);
    vv.addEventListener("scroll", update);
    return () => { vv.removeEventListener("resize", update); vv.removeEventListener("scroll", update); };
  }, []);

  return (
    <div className="fixed inset-0 z-50 bg-black/20 backdrop-blur-sm"
      style={{ opacity: mounted ? 1 : 0, transition: "opacity 0.25s" }}
      onClick={onClose}>
      <div className="absolute inset-x-0 rounded-t-2xl bg-white shadow-2xl px-5 pt-3 pb-6"
        style={{ bottom: keyboardOffset, transform: mounted ? "translateY(0)" : "translateY(100%)", transition: "transform 0.35s cubic-bezier(0.32,0.72,0,1)" }}
        onClick={e => e.stopPropagation()}>
        <div className="flex justify-center mb-3">
          <div className="w-10 h-1 rounded-full bg-stone-300" />
        </div>
        <p className="text-base font-semibold text-gray-900 mb-3">New task</p>
        <input ref={inputRef} value={title} onChange={e => setTitle(e.target.value)}
          onKeyDown={e => e.key === "Enter" && onSubmit()}
          placeholder="Task title" style={{ fontSize: "16px" }}
          className="w-full border-b border-stone-200 pb-2 mb-4 text-gray-900 outline-none placeholder:text-stone-400 bg-transparent" />
        <div className="flex items-center justify-between">
          <div className="relative">
            <select value={destination} onChange={e => setDestination(e.target.value)}
              className="appearance-none bg-stone-100 rounded-full px-3 py-1.5 pr-7 text-sm text-stone-700 outline-none font-medium">
              {databases.map(db => <option key={db.id} value={db.id}>{db.name}</option>)}
            </select>
            <ChevronDown className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-stone-500" />
          </div>
          <div className="flex items-center gap-2">
            <button onClick={onClose} className="px-3 py-2 text-sm text-stone-500 hover:text-stone-700 transition-colors">Cancel</button>
            <button onClick={onSubmit} disabled={!title.trim()}
              className="px-4 py-2 rounded-xl bg-blue-500 text-sm text-white font-semibold transition-colors hover:bg-blue-600 disabled:opacity-40">
              Add
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── EmptyState ───────────────────────────────────────────────────────────────

function EmptyState({ navView, hasQuery, sourceName }: { navView: NavView; hasQuery: boolean; sourceName?: string }) {
  const msgMap: Record<string, { title: string; sub: string }> = {
    inbox: { title: "Inbox zero 🎉", sub: "Nothing waiting to be sorted." },
    today: { title: "All clear for today", sub: "No tasks due today or overdue." },
    upcoming: { title: "Nothing upcoming", sub: "No tasks scheduled ahead." },
    anytime: { title: "Nothing here", sub: "No tasks without a due date." },
    delegated: { title: "Nothing delegated", sub: "No tasks assigned to others." },
    source: { title: "All caught up", sub: `No open tasks in ${sourceName || "this database"}.` },
  };
  const msg = msgMap[navView] ?? msgMap.source;
  return (
    <div className="flex flex-col items-center justify-center py-24 text-center">
      <div className="text-4xl mb-3 select-none">✓</div>
      <p className="font-semibold text-gray-900">{hasQuery ? "No matching tasks" : msg.title}</p>
      <p className="text-sm text-stone-400 mt-1">{hasQuery ? "Try a different search term." : msg.sub}</p>
    </div>
  );
}

// ─── LoadingState ─────────────────────────────────────────────────────────────

function LoadingState() {
  return (
    <div className="pt-4 space-y-4">
      {[75, 55, 85, 60, 70].map((w, i) => (
        <div key={i} className="flex items-center gap-3">
          <div className="w-5 h-5 rounded-full bg-stone-100 animate-pulse shrink-0" />
          <div className="flex-1 space-y-1.5">
            <div className="h-3.5 bg-stone-100 animate-pulse rounded" style={{ width: `${w}%` }} />
            <div className="h-2.5 bg-stone-50 animate-pulse rounded w-20" />
          </div>
        </div>
      ))}
    </div>
  );
}





