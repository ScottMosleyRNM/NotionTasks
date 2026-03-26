export const DATABASE_IDS =
  process.env.NOTION_DATABASE_ALLOWLIST?.split(",") || [];

export const INBOX_DB = process.env.NOTION_INBOX_DATABASE_ID!;
export const DEFAULT_ASSIGNEE = process.env.NOTION_DEFAULT_ASSIGNEE_ID!;
