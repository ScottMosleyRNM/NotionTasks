import { notion } from "@/lib/notion";
import { DATABASE_IDS, INBOX_DB, getDatabaseLabels } from "@/lib/config";
import { NextResponse } from "next/server";

function richTextToPlain(arr: any[] | undefined) {
  if (!Array.isArray(arr)) return "";
  return arr.map((t) => t?.plain_text || "").join("");
}

function getTitle(props: any) {
  for (const key of Object.keys(props || {})) {
    const prop = props[key];
    if (prop?.type === "title") {
      return richTextToPlain(prop.title) || "Untitled";
    }
  }
  return "Untitled";
}

function getDue(props: any) {
  if (props?.["Due"]?.date?.start) return props["Due"].date.start;
  if (props?.["Due date"]?.date?.start) return props["Due date"].date.start;
  for (const key of Object.keys(props || {})) {
    const prop = props[key];
    if (prop?.type === "date" && prop.date?.start) return prop.date.start;
  }
  return undefined;
}

function getStatus(props: any) {
  if (props?.["Status"]?.status?.name) return props["Status"].status.name;
  if (props?.["Status"]?.select?.name) return props["Status"].select.name;
  for (const key of Object.keys(props || {})) {
    const prop = props[key];
    if (prop?.type === "status" && prop.status?.name) return prop.status.name;
    if (prop?.type === "select" && prop.select?.name) return prop.select.name;
  }
  return "Unknown";
}

function getAssignee(props: any) {
  if (props?.["Assignee"]?.people?.[0]?.name) return props["Assignee"].people[0].name;
  for (const key of Object.keys(props || {})) {
    const prop = props[key];
    if (prop?.type === "people" && prop.people?.[0]?.name) return prop.people[0].name;
  }
  return undefined;
}

function extractIcon(icon: any): string | undefined {
  if (!icon) return undefined;
  if (icon.type === "emoji") return icon.emoji;
  if (icon.type === "external") return icon.external?.url;
  // Skip "file" type — those URLs have expiry times
  return undefined;
}

export async function GET() {
  const labels = getDatabaseLabels();
  const results: any[] = [];

  // Pre-fetch DB metadata (real name + icon) in parallel before querying tasks
  const dbMeta: Record<string, { name: string; icon?: string }> = {};
  await Promise.all(
    DATABASE_IDS.map(async (dbId) => {
      try {
        const db = await notion.databases.retrieve({ database_id: dbId }) as any;
        const notionTitle =
          (db.title || []).map((t: any) => t.plain_text).join("") || dbId.slice(0, 6);
        dbMeta[dbId] = {
          name: labels[dbId] || notionTitle,
          icon: extractIcon(db.icon),
        };
      } catch {
        dbMeta[dbId] = { name: labels[dbId] || dbId.slice(0, 6) };
      }
    })
  );

  for (const dbId of DATABASE_IDS) {
    try {
      const response = await notion.databases.query({
        database_id: dbId,
        page_size: 100,
      });

      for (const page of response.results) {
        if (!("properties" in page)) continue;
        const safePage = page as any;
        const props = safePage.properties ?? {};
        results.push({
          id: safePage.id,
          title: getTitle(props),
          due: getDue(props),
          status: getStatus(props),
          assignee: getAssignee(props),
          databaseId: dbId,
          database: dbMeta[dbId]?.name ?? dbId.slice(0, 6),
          databaseIcon: dbMeta[dbId]?.icon,
          pageIcon: extractIcon(safePage.icon),
          isInbox: dbId === INBOX_DB,
          url: safePage.url,
          createdTime: safePage.created_time,
          lastEditedTime: safePage.last_edited_time,
        });
      }
    } catch (error) {
      console.error("DB ERROR", dbId, error);
    }
  }

  results.sort((a, b) => {
    const aDue = a.due || "9999-12-31";
    const bDue = b.due || "9999-12-31";
    if (aDue !== bDue) return aDue.localeCompare(bDue);
    return String(a.title).localeCompare(String(b.title));
  });

  return NextResponse.json(results);
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { title, databaseId, status } = body as {
      title: string;
      databaseId: string;
      status?: string;
    };

    if (!title || !databaseId) {
      return NextResponse.json({ error: "title and databaseId are required" }, { status: 400 });
    }

    // Retrieve DB schema to find the title property key and status type
    const db = await notion.databases.retrieve({ database_id: databaseId }) as any;
    const dbProps = db.properties || {};

    // Build properties object
    const properties: Record<string, any> = {};

    // Set title
    for (const [key, prop] of Object.entries(dbProps)) {
      if ((prop as any).type === "title") {
        properties[key] = { title: [{ text: { content: title } }] };
        break;
      }
    }

    // Set status if provided
    if (status) {
      if (dbProps["Status"]?.type === "status") {
        properties["Status"] = { status: { name: status } };
      } else if (dbProps["Status"]?.type === "select") {
        properties["Status"] = { select: { name: status } };
      } else {
        for (const [key, prop] of Object.entries(dbProps)) {
          if ((prop as any).type === "status") {
            properties[key] = { status: { name: status } };
            break;
          }
          if ((prop as any).type === "select") {
            properties[key] = { select: { name: status } };
            break;
          }
        }
      }
    }

    const page = await notion.pages.create({
      parent: { database_id: databaseId },
      properties,
    }) as any;

    const labels = getDatabaseLabels();
    const dbTitle = (db.title || []).map((t: any) => t.plain_text).join("") || databaseId.slice(0, 6);
    return NextResponse.json({
      id: page.id,
      title,
      status: status || "Unknown",
      databaseId,
      database: labels[databaseId] || dbTitle,
      databaseIcon: extractIcon(db.icon),
      isInbox: databaseId === INBOX_DB,
      url: page.url,
      createdTime: page.created_time,
      lastEditedTime: page.last_edited_time,
    });
  } catch (error) {
    console.error("POST task error", error);
    return NextResponse.json({ error: "Failed to create task" }, { status: 500 });
  }
}
