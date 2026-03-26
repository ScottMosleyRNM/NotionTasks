import { notion } from "@/lib/notion";
import { DATABASE_IDS } from "@/lib/config";
import { NextResponse } from "next/server";

export async function GET() {
  const results: any[] = [];

  for (const dbId of DATABASE_IDS) {
    try {
      const response = await notion.databases.query({
        database_id: dbId,
        page_size: 50,
      });

      for (const page of response.results) {
        if (!("properties" in page)) continue;

        const safePage = page as any;
        const props = safePage.properties ?? {};

        results.push({
          id: safePage.id,
          title:
            props["Task"]?.title?.[0]?.plain_text ||
            props["Task name"]?.title?.[0]?.plain_text ||
            "Untitled",
          due:
            props["Due"]?.date?.start ||
            props["Due date"]?.date?.start,
          status:
            props["Status"]?.status?.name ||
            props["Status"]?.select?.name ||
            "Unknown",
          assignee: props["Assignee"]?.people?.[0]?.name,
          databaseId: dbId,
          url: safePage.url,
        });
      }
    } catch (err) {
      console.error("DB ERROR", dbId, err);
    }
  }

  return NextResponse.json(results);
}
