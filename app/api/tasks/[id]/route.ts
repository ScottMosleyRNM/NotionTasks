import { notion } from "@/lib/notion";
import { NextResponse } from "next/server";

export async function GET(
  _req: Request,
  { params }: { params: { id: string } }
) {
  const page = await notion.pages.retrieve({ page_id: params.id });
  const blocks = await notion.blocks.children.list({ block_id: params.id, page_size: 100 });

  return NextResponse.json({
    page,
    blocks: blocks.results,
    next_cursor: blocks.next_cursor,
    has_more: blocks.has_more,
  });
}
