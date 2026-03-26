export const DATABASE_IDS =
  process.env.NOTION_DATABASE_ALLOWLIST?.split(",").map((id) => id.trim()).filter(Boolean) || [];

export const INBOX_DB = process.env.NOTION_INBOX_DATABASE_ID || "";
export const DEFAULT_ASSIGNEE = process.env.NOTION_DEFAULT_ASSIGNEE_ID || "";

export function getDatabaseLabels(): Record<string, string> {
  try {
    return JSON.parse(process.env.NOTION_DATABASE_LABELS_JSON || "{}");
  } catch {
    return {};
  }
}
