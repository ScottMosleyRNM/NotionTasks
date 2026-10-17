import type { NextRequest } from "next/server";

// Must exactly match a redirect URI registered on the Notion integration.
export function redirectUri(req: NextRequest) {
  return process.env.NOTION_REDIRECT_URI || `${req.nextUrl.origin}/api/auth/callback`;
}
