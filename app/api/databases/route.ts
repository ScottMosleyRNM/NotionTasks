import { notion } from "@/lib/notion";
import { DATABASE_IDS, INBOX_DB, getDatabaseLabels } from "@/lib/config";
import { NextResponse } from "next/server";

function extractIcon(icon: any): string | undefined {
  if (!icon) return undefined;
  if (icon.type === "emoji") return icon.emoji;
  if (icon.type === "external") return icon.external?.url;
  if (icon.type === "file") return icon.file?.url;
  return undefined;
}

export async function GET() {
  const labels = getDatabaseLabels();
  const databases: {
    id: string;
    name: string;
    icon?: string;
    statuses: string[];
    areas: string[];
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

      // Extract Project/Area options for Things-style navigation
      const areas: string[] = [];
      const areaFieldNames = ["Project", "Projects", "Area", "Areas"];
      outer: for (const fieldName of areaFieldNames) {
        for (const prop of Object.values(db.properties || {}) as any[]) {
          if (prop.name === fieldName && prop.type === "select") {
            areas.push(...(prop.select?.options || []).map((o: any) => o.name).filter(Boolean));
            break outer;
          }
          if (prop.name === fieldName && prop.type === "multi_select") {
            areas.push(...(prop.multi_select?.options || []).map((o: any) => o.name).filter(Boolean));
            break outer;
          }
        }
      }

      // DB title from Notion, overridden by label config
      const notionTitle = (db.title || []).map((t: any) => t.plain_text).join("") || dbId.slice(0, 6);

      databases.push({
        id: dbId,
        name: labels[dbId] || notionTitle,
        icon: extractIcon(db.icon),
        statuses,
        areas,
        isInbox: dbId === INBOX_DB || notionTitle.toLowerCase().includes("inbox"),
      });
    } catch (error) {
      console.error("DB retrieve error", dbId, error);
    }
  }

  return NextResponse.json(databases);
}
