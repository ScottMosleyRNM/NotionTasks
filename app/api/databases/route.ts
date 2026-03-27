import { notion } from "@/lib/notion";
import { DATABASE_IDS, INBOX_DB, getDatabaseLabels } from "@/lib/config";
import { NextResponse } from "next/server";

export async function GET() {
  const labels = getDatabaseLabels();
  const databases: {
    id: string;
    name: string;
    statuses: string[];
    isInbox: boolean;
  }[] = [];

  for (const dbId of DATABASE_IDS) {
    try {
      const db = await notion.databases.retrieve({ database_id: dbId }) as any;

      // Extract status options from schema
      const statuses: string[] = [];
      for (const prop of Object.values(db.properties || {}) as any[]) {
        if (prop.type === "status") {
          const groups: any[] = prop.status?.groups || [];
          const options: any[] = prop.status?.options || [];
          // Prefer options ordered by group (not started → in progress → done)
          if (groups.length > 0) {
            for (const group of groups) {
              for (const optionId of group.option_ids || []) {
                const opt = options.find((o: any) => o.id === optionId);
                if (opt) statuses.push(opt.name);
              }
            }
          } else {
            statuses.push(...options.map((o: any) => o.name));
          }
          break;
        }
        if (prop.name === "Status" && prop.type === "select") {
          statuses.push(...(prop.select?.options || []).map((o: any) => o.name));
          break;
        }
      }

      // DB title from Notion, overridden by label config
      const notionTitle = (db.title || []).map((t: any) => t.plain_text).join("") || dbId.slice(0, 6);

      databases.push({
        id: dbId,
        name: labels[dbId] || notionTitle,
        statuses,
        isInbox: dbId === INBOX_DB,
      });
    } catch (error) {
      console.error("DB retrieve error", dbId, error);
    }
  }

  return NextResponse.json(databases);
}
