import { cookies } from "next/headers";

// The whole session lives in one AES-GCM encrypted, http-only cookie, so the
// app needs no database. The Notion access token never reaches the browser.

export type SelectedDb = { id: string; mine: boolean };

export type Session = {
  token: string;
  userId: string;
  userName: string;
  userAvatar?: string;
  userEmail?: string;
  workspaceName: string;
  workspaceIcon?: string;
  dbs: SelectedDb[];
};

const COOKIE = "nt_session";
const MAX_AGE = 60 * 60 * 24 * 180; // 180 days

async function getKey() {
  const secret = process.env.SESSION_SECRET;
  if (!secret || secret.length < 32) {
    throw new Error("SESSION_SECRET must be set to at least 32 characters");
  }
  const hash = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(secret));
  return crypto.subtle.importKey("raw", hash, "AES-GCM", false, ["encrypt", "decrypt"]);
}

function toB64Url(bytes: Uint8Array) {
  return Buffer.from(bytes).toString("base64url");
}

function fromB64Url(s: string) {
  return new Uint8Array(Buffer.from(s, "base64url"));
}

// Compact on-the-wire shape keeps the cookie well under the 4 KB limit.
type Packed = [string, string, string, string | undefined, string | undefined, string, string | undefined, [string, 0 | 1][]];

export async function encodeSession(s: Session): Promise<string> {
  const packed: Packed = [
    s.token, s.userId, s.userName, s.userAvatar, s.userEmail,
    s.workspaceName, s.workspaceIcon,
    s.dbs.map((d) => [d.id.replace(/-/g, ""), d.mine ? 1 : 0]),
  ];
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const data = new TextEncoder().encode(JSON.stringify(packed));
  const enc = new Uint8Array(await crypto.subtle.encrypt({ name: "AES-GCM", iv }, await getKey(), data));
  return `${toB64Url(iv)}.${toB64Url(enc)}`;
}

export async function decodeSession(raw: string): Promise<Session | null> {
  try {
    const [ivPart, dataPart] = raw.split(".");
    const plain = await crypto.subtle.decrypt(
      { name: "AES-GCM", iv: fromB64Url(ivPart) },
      await getKey(),
      fromB64Url(dataPart),
    );
    const p = JSON.parse(new TextDecoder().decode(plain)) as Packed;
    return {
      token: p[0], userId: p[1], userName: p[2], userAvatar: p[3] ?? undefined,
      userEmail: p[4] ?? undefined, workspaceName: p[5], workspaceIcon: p[6] ?? undefined,
      dbs: (p[7] ?? []).map(([id, mine]) => ({ id: dashify(id), mine: mine === 1 })),
    };
  } catch {
    return null;
  }
}

export function dashify(id: string) {
  const h = id.replace(/-/g, "");
  if (h.length !== 32) return id;
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`;
}

export async function getSession(): Promise<Session | null> {
  const raw = cookies().get(COOKIE)?.value;
  return raw ? decodeSession(raw) : null;
}

export async function saveSession(s: Session) {
  cookies().set(COOKIE, await encodeSession(s), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: MAX_AGE,
  });
}

export function clearSession() {
  cookies().delete(COOKIE);
}
