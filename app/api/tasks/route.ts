import { notion } from "@/lib/notion";
import { DATABASE_IDS, getDatabaseLabels } from "@/lib/config";
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

export async function GET() {
  const labels = getDatabaseLabels();
  const results: any[] = [];

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
          database: labels[dbId] || dbId.slice(0, 6),
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
