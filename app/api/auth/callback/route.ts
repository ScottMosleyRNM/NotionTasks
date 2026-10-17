import { NextRequest, NextResponse } from "next/server";
import { getSession, saveSession } from "@/lib/session";
import { redirectUri } from "@/lib/oauth";

export const dynamic = "force-dynamic";

function fail(req: NextRequest, reason: string) {
  return NextResponse.redirect(new URL(`/?auth_error=${encodeURIComponent(reason)}`, req.nextUrl.origin));
}

export async function GET(req: NextRequest) {
  const code = req.nextUrl.searchParams.get("code");
  const state = req.nextUrl.searchParams.get("state");
  const error = req.nextUrl.searchParams.get("error");
  if (error) return fail(req, error === "access_denied" ? "Sign-in was cancelled" : error);
  if (!code) return fail(req, "Missing authorization code");
  if (!state || state !== req.cookies.get("nt_oauth_state")?.value) return fail(req, "Sign-in expired, please try again");

  const basic = Buffer.from(`${process.env.NOTION_OAUTH_CLIENT_ID}:${process.env.NOTION_OAUTH_CLIENT_SECRET}`).toString("base64");
  const tokenRes = await fetch("https://api.notion.com/v1/oauth/token", {
    method: "POST",
    headers: {
      Authorization: `Basic ${basic}`,
      "Content-Type": "application/json",
      "Notion-Version": "2022-06-28",
    },
    body: JSON.stringify({ grant_type: "authorization_code", code, redirect_uri: redirectUri(req) }),
  });
  if (!tokenRes.ok) {
    console.error("Notion token exchange failed", tokenRes.status, await tokenRes.text());
    return fail(req, "Couldn't complete sign-in with Notion");
  }
  const t = await tokenRes.json();
  const owner = t.owner?.user;
  if (!owner?.id) return fail(req, "Notion didn't return a user for this sign-in");

  // Signing in again (e.g. to share more databases) keeps existing choices.
  const previous = await getSession();
  const keepDbs = previous && previous.userId === owner.id ? previous.dbs : [];

  await saveSession({
    token: t.access_token,
    userId: owner.id,
    userName: owner.name ?? "",
    userAvatar: owner.avatar_url ?? undefined,
    userEmail: owner.person?.email ?? undefined,
    workspaceName: t.workspace_name ?? "Notion",
    workspaceIcon: t.workspace_icon ?? undefined,
    dbs: keepDbs,
  });

  const res = NextResponse.redirect(new URL(keepDbs.length ? "/" : "/?settings=1", req.nextUrl.origin));
  res.cookies.delete("nt_oauth_state");
  return res;
}
