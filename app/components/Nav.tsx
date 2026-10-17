"use client";

import { ChevronRight, RefreshCw, Search, Settings as SettingsIcon } from "lucide-react";
import type { TaskDatabase } from "@/lib/types";
import { DbIcon, ListIcon, SMART_LISTS, type ListId } from "./ui";

export type Counts = { today: number; overdue: number; upcoming: number; anytime: number; byDb: Record<string, number> };

type Props = {
  active: ListId | null;
  databases: TaskDatabase[];
  counts: Counts;
  refreshing: boolean;
  onSelect: (id: ListId) => void;
  onSettings: () => void;
  onSearch: () => void;
};

function countFor(id: ListId, counts: Counts) {
  if (id === "today") return counts.today;
  if (id === "upcoming") return counts.upcoming;
  if (id.startsWith("db:")) return counts.byDb[id.slice(3)] ?? 0;
  return 0; // Anytime and Logbook show no count, like Things
}

// Desktop and iPad: a quiet grey sidebar.
export function Sidebar({ active, databases, counts, refreshing, onSelect, onSettings, onSearch }: Props) {
  const item = (id: ListId, label: string, icon: React.ReactNode) => {
    const count = countFor(id, counts);
    const on = active === id;
    return (
      <button
        key={id}
        onClick={() => onSelect(id)}
        className={`flex w-full items-center gap-2.5 rounded-md px-2.5 py-[5px] text-left text-[14px] ${
          on ? "bg-zinc-200/80 font-medium" : "hover:bg-zinc-200/50"
        }`}
      >
        <span className="flex w-[18px] justify-center">{icon}</span>
        <span className="min-w-0 flex-1 truncate">{label}</span>
        {id === "today" && counts.overdue > 0 && (
          <span className="rounded-full bg-things-red px-1.5 text-[11px] font-semibold leading-[18px] text-white">{counts.overdue}</span>
        )}
        {count > 0 && <span className="text-[12px] text-muted">{count}</span>}
      </button>
    );
  };

  return (
    <aside className="pt-safe hidden w-[248px] shrink-0 flex-col border-r border-hairline bg-sidebar md:flex">
      <div className="flex-1 overflow-y-auto px-3 pb-4 pt-12">
        <button
          onClick={onSearch}
          className="mb-4 flex w-full items-center gap-2 rounded-md bg-zinc-200/60 px-2.5 py-1.5 text-[13px] text-muted hover:bg-zinc-200"
        >
          <Search className="h-3.5 w-3.5" /> Quick Find
          <kbd className="ml-auto font-sans text-[11px]">/</kbd>
        </button>
        <div className="space-y-px">{SMART_LISTS.slice(0, 3).map((l) => item(l.id, l.label, <ListIcon id={l.id} size={16} />))}</div>
        <div className="mt-4 space-y-px">{item("logbook", "Logbook", <ListIcon id="logbook" size={16} />)}</div>

        {databases.length > 0 && (
          <div className="mt-6 space-y-px">
            {databases.map((db) => item(`db:${db.id}`, db.name, <DbIcon icon={db.icon} size={16} />))}
          </div>
        )}
      </div>
      <div className="flex items-center justify-between border-t border-hairline px-3 py-2">
        <button onClick={onSettings} className="flex items-center gap-1.5 rounded-md px-2 py-1 text-[13px] text-muted hover:bg-zinc-200/60" title="Settings">
          <SettingsIcon className="h-4 w-4" /> Settings
        </button>
        <RefreshCw className={`mr-2 h-3.5 w-3.5 text-faint transition-opacity ${refreshing ? "animate-spin opacity-100" : "opacity-0"}`} />
      </div>
    </aside>
  );
}

// iPhone: the list of lists is its own screen, as in Things for iOS.
export function MobileHome({ databases, counts, refreshing, onSelect, onSettings, onSearch }: Props) {
  const row = (id: ListId, label: string, icon: React.ReactNode) => {
    const count = countFor(id, counts);
    return (
      <button key={id} onClick={() => onSelect(id)} className="flex w-full items-center gap-3.5 px-4 py-[11px] text-left active:bg-zinc-100">
        <span className="flex w-6 justify-center">{icon}</span>
        <span className="min-w-0 flex-1 truncate text-[17px]">{label}</span>
        {id === "today" && counts.overdue > 0 && (
          <span className="rounded-full bg-things-red px-2 text-[12px] font-semibold leading-5 text-white">{counts.overdue}</span>
        )}
        {count > 0 && <span className="text-[15px] text-muted">{count}</span>}
        <ChevronRight className="h-4 w-4 text-faint" />
      </button>
    );
  };

  return (
    <div className="pt-safe pb-safe min-h-[100dvh] bg-white md:hidden">
      <div className="flex items-center justify-end gap-1 px-3 pt-3">
        {refreshing && <RefreshCw className="mr-2 h-4 w-4 animate-spin text-faint" />}
        <button onClick={onSearch} className="rounded-full p-2 text-things-blue" aria-label="Search">
          <Search className="h-5 w-5" />
        </button>
        <button onClick={onSettings} className="rounded-full p-2 text-things-blue" aria-label="Settings">
          <SettingsIcon className="h-5 w-5" />
        </button>
      </div>
      <nav className="pb-28">
        <div className="py-2">{SMART_LISTS.slice(0, 3).map((l) => row(l.id, l.label, <ListIcon id={l.id} size={22} />))}</div>
        <div className="border-t border-hairline py-2">{row("logbook", "Logbook", <ListIcon id="logbook" size={22} />)}</div>
        {databases.length > 0 && (
          <div className="border-t border-hairline py-2">
            {databases.map((db) => row(`db:${db.id}`, db.name, <DbIcon icon={db.icon} size={22} />))}
          </div>
        )}
      </nav>
    </div>
  );
}
