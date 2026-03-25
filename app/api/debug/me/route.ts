import { notion } from "@/lib/notion";
import { NextResponse } from "next/server";

export async function GET() {
  const users = await notion.users.list({});

  return NextResponse.json({ users });
}
