// Shared between the API routes and the client.

export type Person = { id: string; name: string; avatar?: string };

export type StatusGroup = "todo" | "in_progress" | "complete";

export type Task = {
  id: string;
  title: string;
  icon?: string;
  due?: string; // YYYY-MM-DD (or ISO datetime)
  status?: string;
  statusGroup: StatusGroup;
  assignees: Person[];
  creator?: Person;
  databaseId: string;
  url: string;
  createdTime: string;
  lastEditedTime: string;
};

export type TaskDatabase = {
  id: string;
  name: string;
  icon?: string;
  url: string;
  // Only tasks where the assignee property contains the signed-in user.
  mineOnly: boolean;
  hasAssignee: boolean;
  statuses: { name: string; group: StatusGroup }[];
};

// A database the user shared with the app, shown in Settings.
export type AvailableDatabase = {
  id: string;
  name: string;
  icon?: string;
  url: string;
  selected: boolean;
  mineOnly: boolean;
  hasStatus: boolean;
  hasAssignee: boolean;
  hasDue: boolean;
};

export type Me = {
  signedIn: boolean;
  configured?: boolean;
  user?: Person & { email?: string };
  workspace?: { name: string; icon?: string };
};

export type PropertyValue =
  | { kind: "text"; value: string }
  | { kind: "date"; start: string; end?: string }
  | { kind: "people"; people: Person[] }
  | { kind: "chips"; chips: { name: string; color?: string }[] }
  | { kind: "checkbox"; value: boolean }
  | { kind: "url"; value: string }
  | { kind: "relation"; count: number };

export type TaskDetail = {
  task: Task;
  body: { type: string; text: string; checked?: boolean }[];
  // Database-specific properties, minus the ones already shown on the row.
  properties: { name: string; value: PropertyValue }[];
};
