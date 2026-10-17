"use client";

import { useEffect, useState } from "react";
import { ChevronLeft, Loader2, LogOut, Plus } from "lucide-react";
import { api } from "@/app/lib/client";
import type { AvailableDatabase, Me } from "@/lib/types";
import { Avatar, DbIcon } from "./ui";

export function Settings({ me, firstRun, onDone, onSignOut }: {
  me: Me;
  firstRun: boolean;
  onDone: () => void;
  onSignOut: () => void;
}) {
  const [dbs, setDbs] = useState<AvailableDatabase[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    api<AvailableDatabase[]>("/api/databases").then(setDbs).catch((e) => setError(e.message));
  }, []);

  const selectedCount = dbs?.filter((d) => d.selected).length ?? 0;
  const update = (id: string, patch: Partial<AvailableDatabase>) =>
    setDbs((prev) => prev?.map((d) => (d.id === id ? { ...d, ...patch } : d)) ?? prev);

  async function save() {
    if (!dbs) return;
    setSaving(true);
    try {
      await api("/api/settings", {
        method: "PUT",
        body: JSON.stringify({ dbs: dbs.filter((d) => d.selected).map((d) => ({ id: d.id, mine: d.mineOnly })) }),
      });
      onDone();
    } catch (e: any) {
      setError(e.message);
      setSaving(false);
    }
  }

  return (
    <main className="pt-safe pb-safe min-h-[100dvh] bg-sidebar">
      <div className="mx-auto max-w-xl px-4 pb-32 pt-6 md:pt-14">
        <div className="mb-6 flex items-center gap-2">
          {!firstRun && (
            <button onClick={onDone} className="-ml-2 flex items-center rounded-lg p-1.5 text-things-blue" aria-label="Back">
              <ChevronLeft className="h-6 w-6" />
            </button>
          )}
          <h1 className="text-[28px] font-bold tracking-tight">{firstRun ? "Choose your task databases" : "Settings"}</h1>
        </div>

        {firstRun && (
          <p className="-mt-3 mb-6 text-[15px] leading-relaxed text-muted">
            Pick the Notion databases that hold your tasks. You'll see the open tasks from each one together.
          </p>
        )}

        <section className="mb-8">
          <h2 className="mb-2 px-1 text-[13px] font-semibold uppercase tracking-wide text-muted">Databases</h2>
          <div className="overflow-hidden rounded-2xl bg-white shadow-sm">
            {!dbs && !error && (
              <div className="flex items-center justify-center gap-2 py-10 text-sm text-muted">
                <Loader2 className="h-4 w-4 animate-spin" /> Loading your databases…
              </div>
            )}
            {dbs?.length === 0 && (
              <p className="px-4 py-8 text-center text-sm text-muted">
                No databases are shared with this app yet. Use "Share more databases" below to pick some in Notion.
              </p>
            )}
            {dbs?.map((db, i) => (
              <div key={db.id} className={i ? "border-t border-hairline" : ""}>
                <label className="flex cursor-pointer items-center gap-3 px-4 py-3">
                  <input
                    type="checkbox"
                    checked={db.selected}
                    onChange={(e) => update(db.id, { selected: e.target.checked })}
                    className="h-[18px] w-[18px] shrink-0 accent-things-blue"
                  />
                  <DbIcon icon={db.icon} size={18} />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[15px]">{db.name}</span>
                    {(!db.hasStatus || !db.hasDue) && (
                      <span className="block text-xs text-muted">
                        {[!db.hasStatus && "no status", !db.hasDue && "no due date"].filter(Boolean).join(" · ")} property
                      </span>
                    )}
                  </span>
                </label>
                {db.selected && db.hasAssignee && (
                  <label className="flex cursor-pointer items-center justify-between gap-3 pb-3 pl-[58px] pr-4 text-[13px] text-muted">
                    Only tasks assigned to me
                    <Toggle checked={db.mineOnly} onChange={(v) => update(db.id, { mineOnly: v })} />
                  </label>
                )}
              </div>
            ))}
          </div>
          <a href="/api/auth/login" className="mt-3 flex items-center gap-1.5 px-1 text-[15px] text-things-blue">
            <Plus className="h-4 w-4" /> Share more databases from Notion
          </a>
        </section>

        <section>
          <h2 className="mb-2 px-1 text-[13px] font-semibold uppercase tracking-wide text-muted">Account</h2>
          <div className="overflow-hidden rounded-2xl bg-white shadow-sm">
            {me.user && (
              <div className="flex items-center gap-3 px-4 py-3">
                <Avatar person={me.user} size={32} />
                <div className="min-w-0 flex-1">
                  <div className="truncate text-[15px]">{me.user.name}</div>
                  <div className="truncate text-xs text-muted">{me.user.email ?? me.workspace?.name}</div>
                </div>
              </div>
            )}
            <button onClick={onSignOut} className="flex w-full items-center gap-3 border-t border-hairline px-4 py-3 text-left text-[15px] text-things-red">
              <LogOut className="h-4 w-4" /> Sign out
            </button>
          </div>
        </section>

        {error && <p className="mt-6 rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p>}
      </div>

      <div className="pb-safe fixed inset-x-0 bottom-0 border-t border-hairline bg-sidebar/90 backdrop-blur">
        <div className="mx-auto flex max-w-xl items-center justify-between gap-4 px-4 py-3">
          <span className="text-sm text-muted">{selectedCount} selected</span>
          <button
            onClick={save}
            disabled={!dbs || selectedCount === 0 || saving}
            className="rounded-xl bg-things-blue px-6 py-2.5 text-[15px] font-semibold text-white transition-opacity disabled:opacity-40"
          >
            {saving ? "Saving…" : firstRun ? "Continue" : "Save"}
          </button>
        </div>
      </div>
    </main>
  );
}

function Toggle({ checked, onChange }: { checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className={`relative h-[22px] w-[38px] shrink-0 rounded-full transition-colors ${checked ? "bg-things-green" : "bg-zinc-300"}`}
    >
      <span className={`absolute top-[2px] h-[18px] w-[18px] rounded-full bg-white shadow transition-all ${checked ? "left-[18px]" : "left-[2px]"}`} />
    </button>
  );
}
