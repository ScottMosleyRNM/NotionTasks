import { notion } from "@/lib/notion";
import { NextResponse } from "next/server";

function richTextToPlain(arr: any[] | undefined) {
  if (!Array.isArray(arr)) return "";
  return arr.map((t) => t?.plain_text || "").join("");
}

function getBodyText(blocks: any[]) {
  const lines: string[] = [];
  for (const block of blocks || []) {
    const type = block?.type;
    if (!type) continue;
    const value = block[type];
    if (["paragraph","heading_1","heading_2","heading_3","bulleted_list_item","numbered_list_item","to_do"].includes(type)) {
      const text = richTextToPlain(value?.rich_text);
      if (text) lines.push(text);
    }
  }
  return lines.join("\n").trim();
}

export async function GET(
  _req: Request,
  { params }: { params: { id: string } }
) {
  const page = await notion.pages.retrieve({ page_id: params.id });
  const blocks = await notion.blocks.children.list({ block_id: params.id, page_size: 100 });

  return NextResponse.json({
    page,
    blocks: blocks.results,
    bodyText: getBodyText(blocks.results as any[]),
    has_more: blocks.has_more,
    next_cursor: blocks.next_cursor,
  });
}
