"use client";

import { Check } from "lucide-react";
import { NotionMark } from "./ui";

export function Welcome({ error }: { error?: string | null }) {
  return (
    <main className="pt-safe pb-safe flex min-h-[100dvh] flex-col items-center justify-center bg-white px-6">
      <div className="w-full max-w-sm text-center">
        <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-[18px] bg-things-blue shadow-lg shadow-blue-500/25">
          <span className="flex h-7 w-7 items-center justify-center rounded-[7px] border-[2.5px] border-white">
            <Check className="h-5 w-5 text-white" strokeWidth={3.5} />
          </span>
        </div>
        <h1 className="text-[28px] font-bold tracking-tight">Tasks</h1>
        <p className="mt-2 text-[15px] leading-relaxed text-muted">
          All the tasks assigned to you across your Notion workspace, in one calm list.
        </p>

        {error && (
          <p className="mt-6 rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700" role="alert">
            {error}
          </p>
        )}

        <a
          href="/api/auth/login"
          className="mt-8 flex w-full items-center justify-center gap-2.5 rounded-xl bg-ink px-5 py-3.5 text-[15px] font-semibold text-white transition-opacity active:opacity-80"
        >
          <NotionMark size={18} />
          Continue with Notion
        </a>
        <p className="mt-4 text-xs leading-relaxed text-muted">
          Notion will ask which databases to share. You can change this any time.
        </p>
      </div>
    </main>
  );
}
