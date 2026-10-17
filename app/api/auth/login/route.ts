import { NextRequest, NextResponse } from "next/server";
import { redirectUri } from "@/lib/oauth";

export const dynamic = "force-dynamic";

// Sends the user to Notion's consent screen, where they choose which pages
// and databases the app can see.
export async function GET(req: NextRequest) {
  const clientId = process.env.NOTION_OAUTH_CLIENT_ID;
  if (!clientId) {
    return NextResponse.json({ error: "NOTION_OAUTH_CLIENT_ID is not configured" }, { status: 500 });
  }
  const state = crypto.randomUUID();
  const url = new URL("https://api.notion.com/v1/oauth/authorize");
  url.searchParams.set("client_id", clientId);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("owner", "user");
  url.searchParams.set("redirect_uri", redirectUri(req));
  url.searchParams.set("state", state);

  const res = NextResponse.redirect(url);
  res.cookies.set("nt_oauth_state", state, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 600,
  });
  return res;
}
