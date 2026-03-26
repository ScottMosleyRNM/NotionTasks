"use client";

import { useEffect, useMemo, useState } from "react";

type Task = {
  id: string;
  title: string;
  due?: string;
  status: string;
  assignee?: string;
  database: string;
  databaseId: string;
  url: string;
};

type TaskDetail = {
  page: any;
  blocks: any[];
  bodyText?: string;
};

function formatDate(date?: string) {
  if (!date) return "";
  return new Date(`${date}T00:00:00`).toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

function statusStyle(status: string) {
  const s = status.toLowerCase();
  if (s.includes("done")) return { bg: "#064e3b", border: "#10b981", color: "#d1fae5" };
  if (s.includes("progress") || s.includes("active") || s.includes("doing")) return { bg: "#1e3a8a", border: "#60a5fa", color: "#dbeafe" };
  if (s.includes("review")) return { bg: "#312e81", border: "#818cf8", color: "#e0e7ff" };
  if (s.includes("block")) return { bg: "#7f1d1d", border: "#f87171", color: "#fee2e2" };
  return { bg: "#27272a", border: "#52525b", color: "#f4f4f5" };
}

function getPropValue(prop: any): string {
  if (!prop) return "";
  if (prop.type === "status") return prop.status?.name || "";
  if (prop.type === "select") return prop.select?.name || "";
  if (prop.type === "date") return prop.date?.start || "";
  if (prop.type === "people") return (prop.people || []).map((p: any) => p.name).filter(Boolean).join(", ");
  if (prop.type === "rich_text") return (prop.rich_text || []).map((t: any) => t.plain_text).join("");
  if (prop.type === "title") return (prop.title || []).map((t: any) => t.plain_text).join("");
  if (prop.type === "number") return prop.number?.toString() || "";
  if (prop.type === "checkbox") return prop.checkbox ? "Yes" : "No";
  if (prop.type === "url") return prop.url || "";
  if (prop.type === "email") return prop.email || "";
  if (prop.type === "phone_number") return prop.phone_number || "";
  return "";
}

export default function Home() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [detail, setDetail] = useState<TaskDetail | null>(null);
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [detailLoading, setDetailLoading] = useState(false);

  useEffect(() => {
    fetch("/api/tasks")
      .then((r) => r.json())
      .then((data) => setTasks(Array.isArray(data) ? data : []))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (!selectedTask) {
      setDetail(null);
      return;
    }
    setDetailLoading(true);
    fetch(`/api/tasks/${selectedTask.id}`)
      .then((r) => r.json())
      .then((data) => setDetail(data))
      .finally(() => setDetailLoading(false));
  }, [selectedTask]);

  const filteredTasks = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return tasks;
    return tasks.filter((task) =>
      [task.title, task.status, task.assignee, task.database]
        .filter(Boolean)
        .join(" ")
        .toLowerCase()
        .includes(q)
    );
  }, [tasks, query]);

  return (
    <main style={{ minHeight: "100vh", background: "#111827" }}>
      <div style={{ maxWidth: 760, margin: "0 auto", padding: 20 }}>
        <div style={{ marginBottom: 18 }}>
          <div style={{ color: "#9ca3af", fontSize: 12, letterSpacing: "0.2em", textTransform: "uppercase" }}>Unified Tasks</div>
          <h1 style={{ margin: "6px 0 8px 0", fontSize: 32, lineHeight: 1.1 }}>Notion task hub</h1>
          <div style={{ color: "#d1d5db", fontSize: 14 }}>Lightweight mobile-first view across your Notion task databases.</div>
        </div>

        <div style={{ display: "flex", gap: 10, marginBottom: 18, position: "sticky", top: 0, background: "#111827", paddingBottom: 10, zIndex: 5 }}>
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search tasks"
            style={{ width: "100%", borderRadius: 12, border: "1px solid #374151", background: "#1f2937", color: "#f9fafb", padding: "12px 14px", fontSize: 14, outline: "none" }}
          />
        </div>

        {loading ? (
          <div style={{ color: "#d1d5db" }}>Loading tasks…</div>
        ) : filteredTasks.length === 0 ? (
          <div style={{ color: "#d1d5db" }}>No tasks found.</div>
        ) : (
          <div style={{ display: "grid", gap: 12 }}>
            {filteredTasks.map((task) => {
              const tone = statusStyle(task.status);
              return (
                <button
                  key={task.id}
                  onClick={() => setSelectedTask(task)}
                  style={{ textAlign: "left", background: "#1f2937", border: "1px solid #374151", borderRadius: 16, padding: 14, color: "#f9fafb", cursor: "pointer", width: "100%" }}
                >
                  <div style={{ fontSize: 16, lineHeight: 1.35 }}>{task.title}</div>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginTop: 10 }}>
                    <span style={{ fontSize: 12, padding: "5px 8px", borderRadius: 999, background: tone.bg, color: tone.color, border: `1px solid ${tone.border}` }}>{task.status}</span>
                    {task.due ? <span style={{ fontSize: 12, padding: "5px 8px", borderRadius: 999, background: "#111827", color: "#e5e7eb", border: "1px solid #374151" }}>{formatDate(task.due)}</span> : null}
                    <span style={{ fontSize: 12, padding: "5px 8px", borderRadius: 999, background: "#111827", color: "#e5e7eb", border: "1px solid #374151" }}>{task.database}</span>
                    {task.assignee ? <span style={{ fontSize: 12, padding: "5px 8px", borderRadius: 999, background: "#111827", color: "#e5e7eb", border: "1px solid #374151" }}>{task.assignee}</span> : null}
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </div>

      {selectedTask ? (
        <div onClick={() => setSelectedTask(null)} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.55)", backdropFilter: "blur(4px)", padding: 16, display: "flex", alignItems: "flex-end", justifyContent: "center", zIndex: 20 }}>
          <div onClick={(e) => e.stopPropagation()} style={{ width: "100%", maxWidth: 760, maxHeight: "88vh", overflow: "auto", background: "#111827", border: "1px solid #374151", borderRadius: 24, padding: 18, boxShadow: "0 20px 60px rgba(0,0,0,0.45)" }}>
            <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "start" }}>
              <div>
                <div style={{ fontSize: 22, lineHeight: 1.25 }}>{selectedTask.title}</div>
                <div style={{ color: "#d1d5db", fontSize: 13, marginTop: 8 }}>
                  {selectedTask.status}
                  {selectedTask.due ? ` · ${formatDate(selectedTask.due)}` : ""}
                  {selectedTask.database ? ` · ${selectedTask.database}` : ""}
                  {selectedTask.assignee ? ` · ${selectedTask.assignee}` : ""}
                </div>
              </div>
              <div style={{ display: "flex", gap: 8, flexShrink: 0 }}>
                <a href={selectedTask.url} target="_blank" rel="noreferrer" style={{ textDecoration: "none", color: "#0f172a", background: "#bae6fd", padding: "10px 12px", borderRadius: 999, fontSize: 13, fontWeight: 600 }}>
                  Open in Notion
                </a>
                <button onClick={() => setSelectedTask(null)} style={{ border: "1px solid #374151", background: "#1f2937", color: "#f9fafb", padding: "10px 12px", borderRadius: 999, fontSize: 13, cursor: "pointer" }}>
                  Close
                </button>
              </div>
            </div>

            <div style={{ marginTop: 18 }}>
              {detailLoading ? (
                <div style={{ color: "#d1d5db" }}>Loading details…</div>
              ) : detail ? (
                <div style={{ display: "grid", gap: 16 }}>
                  <section style={{ background: "#1f2937", border: "1px solid #374151", borderRadius: 16, padding: 14 }}>
                    <div style={{ color: "#9ca3af", fontSize: 12, letterSpacing: "0.14em", textTransform: "uppercase", marginBottom: 12 }}>Properties</div>
                    <div style={{ display: "grid", gap: 10 }}>
                      {Object.entries((detail.page as any)?.properties || {})
                        .map(([key, value]: any) => {
                          const pretty = getPropValue(value);
                          if (!pretty) return null;
                          return (
                            <div key={key} style={{ display: "grid", gap: 3 }}>
                              <div style={{ fontSize: 12, color: "#9ca3af" }}>{key}</div>
                              <div style={{ fontSize: 14, color: "#f9fafb" }}>{pretty}</div>
                            </div>
                          );
                        })
                        .filter(Boolean)}
                    </div>
                  </section>

                  <section style={{ background: "#1f2937", border: "1px solid #374151", borderRadius: 16, padding: 14 }}>
                    <div style={{ color: "#9ca3af", fontSize: 12, letterSpacing: "0.14em", textTransform: "uppercase", marginBottom: 12 }}>Page body</div>
                    <div style={{ whiteSpace: "pre-wrap", color: "#e5e7eb", lineHeight: 1.6, fontSize: 14 }}>
                      {detail.bodyText || "No body content found."}
                    </div>
                  </section>
                </div>
              ) : (
                <div style={{ color: "#d1d5db" }}>No details loaded.</div>
              )}
            </div>
          </div>
        </div>
      ) : null}
    </main>
  );
}
