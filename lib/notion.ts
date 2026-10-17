import { Client } from "@notionhq/client";
import { NextResponse } from "next/server";
import { getSession, type Session } from "./session";

export function notionFor(token: string) {
  return new Client({ auth: token });
}

// For API routes: returns the session and a client, or a 401 response.
export async function requireSession(): Promise<
  { session: Session; notion: Client; error?: never } | { error: NextResponse; session?: never; notion?: never }
> {
  const session = await getSession();
  if (!session) {
    return { error: NextResponse.json({ error: "Not signed in" }, { status: 401 }) };
  }
  return { session, notion: notionFor(session.token) };
}

export function extractIcon(icon: any): string | undefined {
  if (!icon) return undefined;
  if (icon.type === "emoji") return icon.emoji;
  if (icon.type === "external") return icon.external?.url;
  if (icon.type === "file") return icon.file?.url;
  return undefined;
}

export function plainText(arr: any[] | undefined) {
  return Array.isArray(arr) ? arr.map((t) => t?.plain_text ?? "").join("") : "";
}

export function databaseTitle(db: any) {
  return plainText(db.title) || "Untitled database";
}

// Runs async work over items with limited parallelism (Notion allows ~3 req/s).
export async function mapLimit<T, R>(items: T[], limit: number, fn: (item: T) => Promise<R>): Promise<R[]> {
  const out: R[] = new Array(items.length);
  let next = 0;
  async function worker() {
    while (next < items.length) {
      const i = next++;
      out[i] = await fn(items[i]);
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));
  return out;
}

// Database schemas change rarely; cache them briefly per token to avoid an
// extra API call per database on every refresh.
const dbCache = new Map<string, { at: number; db: any }>();
const DB_TTL = 5 * 60 * 1000;

export async function retrieveDatabase(notion: Client, token: string, id: string, fresh = false) {
  const key = `${token.slice(-12)}:${id}`;
  const hit = dbCache.get(key);
  if (!fresh && hit && Date.now() - hit.at < DB_TTL) return hit.db;
  const db = await notion.databases.retrieve({ database_id: id });
  dbCache.set(key, { at: Date.now(), db });
  return db;
}
