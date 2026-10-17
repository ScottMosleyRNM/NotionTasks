"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AlertTriangle, ChevronLeft, Loader2, Plus, Search, X } from "lucide-react";
import { api, dayOnly, daysBetween, localDateStr, parseDate, readCache, writeCache } from "@/app/lib/client";
import type { Me, Task, TaskDatabase } from "@/lib/types";
import { MobileHome, Sidebar, type Counts } from "./components/Nav";
import { Settings } from "./components/Settings";
import { DayHeader, NewTaskCard, SectionHeader, TaskList, type Section } from "./components/TaskList";
import { DbIcon, ListIcon, SMART_LISTS, type ListId } from "./components/ui";
import { Welcome } from "./components/Welcome";

type TasksResponse = { databases: TaskDatabase[]; tasks: Task[]; errors: { databaseId: string; message: string }[] };

const byDue = (a: Task, b: Task) => (a.due ?? "9999").localeCompare(b.due ?? "9999") || a.title.localeCompare(b.title);

function readHash(): ListId | null {
  const h = decodeURIComponent(window.location.hash.slice(1));
  if (SMART_LISTS.some((l) => l.id === h) || h.startsWith("db:")) return h as ListId;
  return null;
}

export default function Home() {
  const [me, setMe] = useState<Me | null>(null);
  const [authError, setAuthError] = useState<string | null>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);

  const [databases, setDatabases] = useState<TaskDatabase[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loadErrors, setLoadErrors] = useState<TasksResponse["errors"]>([]);
  const [loaded, setLoaded] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [logbook, setLogbook] = useState<Task[] | null>(null);

  const [list, setList] = useState<ListId | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const [searching, setSearching] = useState(false);
  const [query, setQuery] = useState("");
  const [completing, setCompleting] = useState<Set<string>>(new Set());
  const [toast, setToast] = useState<string | null>(null);

  const lastLoad = useRef(0);
  const cameFromHome = useRef(false);
  const cacheKey = me?.user ? `nt:v3:${me.user.id}` : null;
  const today = localDateStr();

  const showToast = useCallback((msg: string) => {
    setToast(msg);
    window.setTimeout(() => setToast((t) => (t === msg ? null : t)), 4000);
  }, []);

  // ── Session ──
  const loadMe = useCallback(async () => {
    try {
      setMe(await api<Me>("/api/me"));
    } catch {
      setMe({ signedIn: false });
    }
  }, []);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("auth_error")) setAuthError(params.get("auth_error"));
    if (params.has("settings")) setSettingsOpen(true);
    if (params.toString()) window.history.replaceState(null, "", window.location.pathname + window.location.hash);
    setList(readHash());
    const onHash = () => {
      setList(readHash());
      setExpandedId(null);
      setAdding(false);
    };
    window.addEventListener("hashchange", onHash);
    loadMe();
    return () => window.removeEventListener("hashchange", onHash);
  }, [loadMe]);

  const handleApiError = useCallback(
    (e: any) => {
      if (e?.status === 401) {
        setMe({ signedIn: false });
        setAuthError("Your Notion session ended. Please sign in again.");
      } else showToast(e?.message ?? "Something went wrong");
    },
    [showToast],
  );

  // ── Tasks ──
  const load = useCallback(async () => {
    if (!cacheKey) return;
    setRefreshing(true);
    try {
      const r = await api<TasksResponse>("/api/tasks");
      setDatabases(r.databases);
      setTasks(r.tasks);
      setLoadErrors(r.errors);
      writeCache(cacheKey, r);
    } catch (e) {
      handleApiError(e);
    } finally {
      lastLoad.current = Date.now();
      setRefreshing(false);
      setLoaded(true);
    }
  }, [cacheKey, handleApiError]);

  const ready = !!me?.signedIn && !!me.configured && !settingsOpen;

  useEffect(() => {
    if (!ready || !cacheKey) return;
    const cached = readCache<TasksResponse>(cacheKey);
    if (cached) {
      setDatabases(cached.databases);
      setTasks(cached.tasks);
      setLoaded(true);
    }
    load();
    const onVisible = () => document.visibilityState === "visible" && Date.now() - lastLoad.current > 30_000 && load();
    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("focus", onVisible);
    const timer = window.setInterval(load, 3 * 60_000);
    return () => {
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("focus", onVisible);
      window.clearInterval(timer);
    };
  }, [ready, cacheKey, load]);

  useEffect(() => {
    if (list !== "logbook" || !ready) return;
    api<TasksResponse>("/api/tasks?logbook=1")
      .then((r) => setLogbook(r.tasks.sort((a, b) => b.lastEditedTime.localeCompare(a.lastEditedTime))))
      .catch(handleApiError);
  }, [list, ready, handleApiError]);

  // ── Navigation ──
  const desktopList: ListId = list ?? "today";
  const dbMap = useMemo(() => new Map(databases.map((d) => [d.id, d])), [databases]);

  const select = useCallback((id: ListId) => {
    cameFromHome.current = window.location.hash === "";
    setSearching(false);
    setQuery("");
    window.location.hash = encodeURIComponent(id);
  }, []);

  const backToHome = () => {
    if (cameFromHome.current) window.history.back();
    else window.location.hash = "";
    cameFromHome.current = false;
  };

  const startAdding = useCallback(() => {
    setExpandedId(null);
    setSearching(false);
    if (window.location.hash === "" && window.innerWidth < 768) select("anytime");
    setAdding(true);
  }, [select]);

  useEffect(() => {
    if (!ready) return;
    const onKey = (e: KeyboardEvent) => {
      const typing = (e.target as HTMLElement)?.closest?.("input, textarea, select, [contenteditable]");
      if (typing || e.metaKey || e.ctrlKey || e.altKey) return;
      if (e.key === "/") {
        e.preventDefault();
        setSearching(true);
      } else if (e.key === "n") {
        e.preventDefault();
        startAdding();
      } else if (e.key === "Escape") {
        setSearching(false);
        setQuery("");
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [ready, startAdding]);

  // ── Task actions ──
  const replaceTask = useCallback((t: Task) => {
    setTasks((prev) => prev.map((x) => (x.id === t.id ? t : x)));
    setLogbook((prev) => prev?.map((x) => (x.id === t.id ? t : x)) ?? prev);
  }, []);

  const toggle = useCallback(
    async (task: Task) => {
      const reopening = task.statusGroup === "complete";
      if (reopening && completing.has(task.id)) {
        // Undo inside the fade-out window.
        setCompleting((s) => { const n = new Set(s); n.delete(task.id); return n; });
        replaceTask({ ...task, statusGroup: "todo" });
      } else if (reopening) {
        setLogbook((prev) => prev?.filter((x) => x.id !== task.id) ?? prev);
      } else {
        replaceTask({ ...task, statusGroup: "complete" });
        setCompleting((s) => new Set(s).add(task.id));
        window.setTimeout(() => {
          setCompleting((s) => {
            if (s.has(task.id)) {
              setTasks((prev) => prev.filter((x) => x.id !== task.id));
              setExpandedId((id) => (id === task.id ? null : id));
            }
            const n = new Set(s);
            n.delete(task.id);
            return n;
          });
        }, 1600);
      }
      try {
        const updated = await api<Task>(`/api/tasks/${task.id}`, { method: "PATCH", body: JSON.stringify({ complete: !reopening }) });
        if (reopening) setTasks((prev) => (prev.some((x) => x.id === updated.id) ? prev.map((x) => (x.id === updated.id ? updated : x)) : [...prev, updated]));
      } catch (e) {
        handleApiError(e);
        load();
      }
    },
    [completing, replaceTask, handleApiError, load],
  );

  const create = useCallback(
    async (input: { title: string; databaseId: string; due?: string }) => {
      setAdding(false);
      try { localStorage.setItem("nt:lastDb", input.databaseId); } catch {}
      try {
        const t = await api<Task>("/api/tasks", { method: "POST", body: JSON.stringify(input) });
        setTasks((prev) => [t, ...prev]);
      } catch (e) {
        handleApiError(e);
      }
    },
    [handleApiError],
  );

  // ── Derived lists ──
  const open = tasks;
  const counts: Counts = useMemo(() => {
    const byDb: Record<string, number> = {};
    let todayN = 0, overdue = 0, upcoming = 0, anytime = 0;
    for (const t of open) {
      if (t.statusGroup === "complete") continue;
      byDb[t.databaseId] = (byDb[t.databaseId] ?? 0) + 1;
      const d = dayOnly(t.due);
      if (!d) anytime++;
      else if (d < today) { overdue++; todayN++; }
      else if (d === today) todayN++;
      else upcoming++;
    }
    return { today: todayN, overdue, upcoming, anytime, byDb };
  }, [open, today]);

  const view = list ?? desktopList;
  const sections: Section[] = useMemo(() => {
    if (searching && query.trim()) {
      const q = query.trim().toLowerCase();
      const hits = open.filter((t) => t.title.toLowerCase().includes(q)).sort(byDue);
      return [{ key: "results", tasks: hits }];
    }
    if (view === "today") {
      return [{ key: "today", tasks: open.filter((t) => { const d = dayOnly(t.due); return d && d <= today; }).sort(byDue) }];
    }
    if (view === "upcoming") {
      const groups = new Map<string, Section>();
      for (const t of open.filter((t) => { const d = dayOnly(t.due); return d && d > today; }).sort(byDue)) {
        const d = dayOnly(t.due)!;
        const date = parseDate(d);
        let key: string, header: React.ReactNode;
        if (daysBetween(today, d) <= 7) {
          key = d;
          header = <DayHeader date={d} today={today} />;
        } else {
          const month = date.toLocaleDateString(undefined, { month: "long", ...(date.getFullYear() !== parseDate(today).getFullYear() ? { year: "numeric" } : {}) });
          key = d.slice(0, 7);
          header = <SectionHeader title={key === today.slice(0, 7) ? `Rest of ${month}` : month} />;
        }
        if (!groups.has(key)) groups.set(key, { key, header, tasks: [] });
        groups.get(key)!.tasks.push(t);
      }
      return Array.from(groups.values());
    }
    if (view === "anytime") {
      return databases
        .map((db) => ({
          key: db.id,
          header: <SectionHeader title={db.name} icon={<DbIcon icon={db.icon} size={16} />} />,
          tasks: open.filter((t) => t.databaseId === db.id && !t.due).sort(byDue),
        }))
        .filter((s) => s.tasks.length);
    }
    if (view === "logbook") {
      const groups = new Map<string, Section>();
      for (const t of logbook ?? []) {
        const d = localDateStr(new Date(t.lastEditedTime));
        const diff = daysBetween(d, today);
        const title = diff === 0 ? "Today" : diff === 1 ? "Yesterday" : parseDate(d).toLocaleDateString(undefined, { month: "long", year: "numeric" });
        if (!groups.has(title)) groups.set(title, { key: title, header: <SectionHeader title={title} />, tasks: [] });
        groups.get(title)!.tasks.push(t);
      }
      return Array.from(groups.values());
    }
    // A single database, like a Things area.
    const dbId = view.slice(3);
    const inDb = open.filter((t) => t.databaseId === dbId).sort(byDue);
    const groups: [string, (d?: string) => boolean][] = [
      ["Overdue", (d) => !!d && d < today],
      ["Today", (d) => d === today],
      ["Upcoming", (d) => !!d && d > today],
      ["No Due Date", (d) => !d],
    ];
    const out = groups
      .map(([title, test]) => ({ key: title, header: <SectionHeader title={title} />, tasks: inDb.filter((t) => test(dayOnly(t.due))) }))
      .filter((s) => s.tasks.length);
    return out.length === 1 ? [{ ...out[0], header: undefined }] : out;
  }, [view, open, today, databases, logbook, searching, query]);

  // ── Render ──
  if (!me) {
    return (
      <div className="flex h-[100dvh] items-center justify-center">
        <Loader2 className="h-5 w-5 animate-spin text-faint" />
      </div>
    );
  }
  if (!me.signedIn) return <Welcome error={authError} />;
  if (!me.configured || settingsOpen) {
    return (
      <Settings
        me={me}
        firstRun={!me.configured}
        onDone={async () => {
          setSettingsOpen(false);
          setLoaded(false);
          await loadMe();
          load();
        }}
        onSignOut={async () => {
          await fetch("/api/auth/logout", { method: "POST" });
          if (cacheKey) try { localStorage.removeItem(cacheKey); } catch {}
          setSettingsOpen(false);
          setMe({ signedIn: false });
        }}
      />
    );
  }

  const isDbView = view.startsWith("db:");
  const currentDb = isDbView ? dbMap.get(view.slice(3)) : undefined;
  const title = searching ? "Quick Find" : currentDb?.name ?? SMART_LISTS.find((l) => l.id === view)?.label ?? "";
  const icon = searching ? <Search className="h-6 w-6 text-muted" /> : currentDb ? <DbIcon icon={currentDb.icon} size={26} /> : <ListIcon id={view} size={26} />;
  const showHomeOnMobile = list === null && !searching;
  const isEmpty = sections.every((s) => s.tasks.length === 0);
  let lastDb: string | null = null;
  try { lastDb = localStorage.getItem("nt:lastDb"); } catch {}
  const defaultDbId = currentDb?.id ?? (lastDb && dbMap.has(lastDb) ? lastDb : databases[0]?.id);

  return (
    <div className="flex h-[100dvh] overflow-hidden bg-white">
      <Sidebar
        active={searching ? null : desktopList}
        databases={databases}
        counts={counts}
        refreshing={refreshing}
        onSelect={select}
        onSettings={() => setSettingsOpen(true)}
        onSearch={() => setSearching(true)}
      />

      {showHomeOnMobile && (
        <div className="flex-1 overflow-y-auto md:hidden">
          <MobileHome
            active={null}
            databases={databases}
            counts={counts}
            refreshing={refreshing}
            onSelect={select}
            onSettings={() => setSettingsOpen(true)}
            onSearch={() => setSearching(true)}
          />
        </div>
      )}

      <main className={`${showHomeOnMobile ? "hidden md:block" : "block"} min-w-0 flex-1 overflow-y-auto`}>
        <div key={searching ? "search" : view} className="pt-safe slide-in mx-auto max-w-[760px] px-5 md:px-14">
          <div className="flex h-12 items-center md:hidden">
            <button
              onClick={() => (searching ? (setSearching(false), setQuery("")) : backToHome())}
              className="-ml-2 flex items-center text-[17px] text-things-blue"
            >
              <ChevronLeft className="h-6 w-6" /> {searching && list ? "Back" : "Lists"}
            </button>
          </div>

          <header className="mb-5 flex items-center gap-3 md:mb-7 md:mt-14">
            {icon}
            <h1 className="min-w-0 flex-1 truncate text-[28px] font-bold tracking-tight">{title}</h1>
          </header>

          {searching && (
            <div className="mb-5 flex items-center gap-2 rounded-xl bg-zinc-100 px-3 py-2">
              <Search className="h-4 w-4 text-muted" />
              <input
                autoFocus
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={(e) => e.key === "Escape" && (setSearching(false), setQuery(""))}
                placeholder="Search all tasks"
                className="min-w-0 flex-1 bg-transparent text-[16px] outline-none"
              />
              {query && (
                <button onClick={() => setQuery("")} aria-label="Clear search"><X className="h-4 w-4 text-muted" /></button>
              )}
            </div>
          )}

          {loadErrors.length > 0 && !searching && (
            <div className="mb-5 flex gap-2 rounded-xl bg-amber-50 px-3 py-2.5 text-[13px] text-amber-900">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
              <div>
                {loadErrors.map((e) => (
                  <p key={e.databaseId}>{dbMap.get(e.databaseId)?.name ?? "A database"}: {e.message}</p>
                ))}
              </div>
            </div>
          )}

          {adding && defaultDbId && (
            <NewTaskCard
              databases={databases}
              defaultDbId={defaultDbId}
              defaultDue={view === "today" ? today : undefined}
              onCreate={create}
              onCancel={() => setAdding(false)}
            />
          )}

          {!loaded || (view === "logbook" && logbook === null && !searching) ? (
            <div className="flex justify-center py-16"><Loader2 className="h-5 w-5 animate-spin text-faint" /></div>
          ) : isEmpty && !adding ? (
            <div className="flex flex-col items-center py-20 text-center text-muted">
              <span className="mb-3 opacity-25 grayscale">{searching ? <Search className="h-12 w-12" /> : currentDb ? <DbIcon icon={currentDb.icon} size={48} /> : <ListIcon id={view} size={48} />}</span>
              <p className="text-[15px]">{searching ? (query ? "No matching tasks" : "Type to search all your tasks") : view === "logbook" ? "Nothing completed recently" : "Nothing here. Enjoy the calm."}</p>
            </div>
          ) : (
            <TaskList
              sections={sections}
              dbs={dbMap}
              meId={me.user?.id}
              showDb={!isDbView}
              hideDue={view === "upcoming" && !searching}
              expandedId={expandedId}
              onExpand={setExpandedId}
              completing={completing}
              onToggle={toggle}
              onUpdated={replaceTask}
              onError={showToast}
            />
          )}
        </div>
      </main>

      {view !== "logbook" && !adding && databases.length > 0 && (
        <button
          onClick={startAdding}
          aria-label="New task"
          title="New task (N)"
          className={`${showHomeOnMobile ? "hidden md:flex" : "flex"} bottom-safe fixed right-5 z-20 h-14 w-14 items-center justify-center rounded-full bg-things-blue text-white shadow-lg shadow-blue-500/30 transition-transform active:scale-95 md:right-8 md:h-12 md:w-12`}
        >
          <Plus className="h-7 w-7 md:h-6 md:w-6" strokeWidth={2.5} />
        </button>
      )}

      {toast && (
        <div className="bottom-safe fixed left-1/2 z-30 -translate-x-1/2 rounded-xl bg-ink px-4 py-2.5 text-sm text-white shadow-lg" role="status">
          {toast}
        </div>
      )}
    </div>
  );
}
