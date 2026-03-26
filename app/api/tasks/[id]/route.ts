import { notion } from "@/lib/notion";
import { NextResponse } from "next/server";

export async function GET(
  _req: Request,
  { params }: { params: { id: string } }
) {
  const page = await notion.pages.retrieve({
    page_id: params.id,
  });

  const blocks = await notion.blocks.children.list({
    block_id: params.id,
  });

  return NextResponse.json({
    page,
    blocks: blocks.results,
  });
}
