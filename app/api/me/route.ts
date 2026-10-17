import { NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import type { Me } from "@/lib/types";

export const dynamic = "force-dynamic";

export async function GET() {
  const s = await getSession();
  const me: Me = s
    ? {
        signedIn: true,
        configured: s.dbs.length > 0,
        user: { id: s.userId, name: s.userName, avatar: s.userAvatar, email: s.userEmail },
        workspace: { name: s.workspaceName, icon: s.workspaceIcon },
      }
    : { signedIn: false };
  return NextResponse.json(me);
}
