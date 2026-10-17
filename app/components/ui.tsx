"use client";

import { Archive, CalendarDays, Check, Layers, Star } from "lucide-react";
import type { Person } from "@/lib/types";

export type ListId = "today" | "upcoming" | "anytime" | "logbook" | `db:${string}`;

export const SMART_LISTS: { id: Exclude<ListId, `db:${string}`>; label: string }[] = [
  { id: "today", label: "Today" },
  { id: "upcoming", label: "Upcoming" },
  { id: "anytime", label: "Anytime" },
  { id: "logbook", label: "Logbook" },
];

// Things-style colored list glyphs.
export function ListIcon({ id, size = 18 }: { id: ListId; size?: number }) {
  const s = { width: size, height: size };
  switch (id) {
    case "today":
      return <Star style={s} className="text-things-yellow" fill="currentColor" strokeWidth={1.5} />;
    case "upcoming":
      return <CalendarDays style={s} className="text-things-red" strokeWidth={2} />;
    case "anytime":
      return <Layers style={s} className="text-things-teal" strokeWidth={2} />;
    case "logbook":
      return <Archive style={s} className="text-things-green" strokeWidth={2} />;
    default:
      return null;
  }
}

// A Notion database icon: emoji, image, or a neutral fallback.
export function DbIcon({ icon, size = 16 }: { icon?: string; size?: number }) {
  if (icon && /^https?:\/\//.test(icon)) {
    return <img src={icon} alt="" width={size} height={size} className="shrink-0 rounded-[3px] object-contain" />;
  }
  if (icon) {
    return (
      <span className="shrink-0 leading-none" style={{ fontSize: size * 0.9, width: size, textAlign: "center" }}>
        {icon}
      </span>
    );
  }
  return (
    <span
      className="shrink-0 rounded-full border-[1.5px] border-things-blue"
      style={{ width: size * 0.8, height: size * 0.8, margin: size * 0.1 }}
    />
  );
}

export function Avatar({ person, size = 20 }: { person: Person; size?: number }) {
  const initials = person.name.split(/\s+/).map((p) => p[0]).slice(0, 2).join("").toUpperCase();
  return person.avatar ? (
    <img
      src={person.avatar}
      alt={person.name}
      title={person.name}
      width={size}
      height={size}
      className="shrink-0 rounded-full object-cover ring-2 ring-white"
    />
  ) : (
    <span
      title={person.name}
      className="flex shrink-0 items-center justify-center rounded-full bg-zinc-200 font-semibold text-zinc-600 ring-2 ring-white"
      style={{ width: size, height: size, fontSize: size * 0.42 }}
    >
      {initials || "?"}
    </span>
  );
}

export function AvatarStack({ people, size = 20, max = 3 }: { people: Person[]; size?: number; max?: number }) {
  if (!people.length) return null;
  return (
    <span className="flex -space-x-1.5">
      {people.slice(0, max).map((p) => (
        <Avatar key={p.id} person={p} size={size} />
      ))}
      {people.length > max && (
        <span
          className="flex items-center justify-center rounded-full bg-zinc-100 text-[10px] font-medium text-zinc-500 ring-2 ring-white"
          style={{ width: size, height: size }}
        >
          +{people.length - max}
        </span>
      )}
    </span>
  );
}

// The Things to-do checkbox: a small rounded square that fills blue when done.
export function Checkbox({ checked, onToggle, label }: { checked: boolean; onToggle: () => void; label: string }) {
  return (
    <button
      type="button"
      role="checkbox"
      aria-checked={checked}
      aria-label={label}
      onClick={(e) => {
        e.stopPropagation();
        onToggle();
      }}
      className="-m-2 flex shrink-0 items-center justify-center p-2"
    >
      <span
        className={`flex h-[17px] w-[17px] items-center justify-center rounded-[5px] border-[1.5px] transition-colors ${
          checked ? "border-things-blue bg-things-blue" : "border-zinc-300 bg-white hover:border-zinc-400"
        }`}
      >
        {checked && <Check className="h-3 w-3 text-white" strokeWidth={3.5} />}
      </span>
    </button>
  );
}

// A small Notion-style "N" tile, for "Open in Notion".
export function NotionMark({ size = 16 }: { size?: number }) {
  return (
    <span
      aria-hidden="true"
      className="flex shrink-0 items-center justify-center rounded-[4px] border-[1.5px] border-current bg-white font-serif font-bold leading-none"
      style={{ width: size, height: size, fontSize: size * 0.68 }}
    >
      N
    </span>
  );
}
