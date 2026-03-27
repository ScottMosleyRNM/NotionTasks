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
    if (
      ["paragraph", "heading_1", "heading_2", "heading_3", "bulleted_list_item", "numbered_list_item", "to_do"].includes(type)
    ) {
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
  try {
    const page = await notion.pages.retrieve({ page_id: params.id });
    const blocks = await notion.blocks.children.list({ block_id: params.id, page_size: 100 });

    return NextResponse.json({
      page,
      blocks: blocks.results,
      bodyText: getBodyText(blocks.results as any[]),
      has_more: blocks.has_more,
      next_cursor: blocks.next_cursor,
    });
  } catch (error) {
    console.error("GET task detail error", params.id, error);
    return NextResponse.json({ error: "Failed to load task" }, { status: 500 });
  }
}

export async function PATCH(
  req: Request,
  { params }: { params: { id: string } }
) {
  try {
    const body = await req.json();

    // Retrieve the page to understand its property types
    const page = await notion.pages.retrieve({ page_id: params.id }) as any;
    const props = page.properties || {};
    const properties: Record<string, any> = {};

    if (body.status !== undefined) {
      let statusKey = "Status";
      let statusType: "status" | "select" = "status";

      if (props["Status"]?.type === "status") {
        statusKey = "Status";
        statusType = "status";
      } else if (props["Status"]?.type === "select") {
        statusKey = "Status";
        statusType = "select";
      } else {
        for (const [key, prop] of Object.entries(props)) {
          if ((prop as any).type === "status") {
            statusKey = key;
            statusType = "status";
            break;
          }
          if ((prop as any).type === "select") {
            statusKey = key;
            statusType = "select";
            break;
          }
        }
      }

      properties[statusKey] =
        statusType === "status"
          ? { status: { name: body.status } }
          : { select: { name: body.status } };
    }

    if (body.due !== undefined) {
      let dueKey = "Due";
      for (const [key, prop] of Object.entries(props)) {
        if ((prop as any).type === "date") {
          dueKey = key;
          break;
        }
      }
      properties[dueKey] = body.due ? { date: { start: body.due } } : { date: null };
    }

    if (body.title !== undefined) {
      for (const [key, prop] of Object.entries(props)) {
        if ((prop as any).type === "title") {
          properties[key] = { title: [{ text: { content: body.title } }] };
          break;
        }
      }
    }

    if (Object.keys(properties).length === 0) {
      return NextResponse.json({ error: "Nothing to update" }, { status: 400 });
    }

    await notion.pages.update({ page_id: params.id, properties });
    return NextResponse.json({ ok: true, id: params.id });
  } catch (error) {
    console.error("PATCH task error", params.id, error);
    return NextResponse.json({ error: "Failed to update task" }, { status: 500 });
  }
}
