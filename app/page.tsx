"use client";

import { useEffect, useState } from "react";

export default function Home() {
  const [tasks, setTasks] = useState<any[]>([]);

  useEffect(() => {
    fetch("/api/tasks")
      .then((r) => r.json())
      .then(setTasks);
  }, []);

  return (
    <main style={{ padding: 20 }}>
      <h1>Tasks</h1>

      {tasks.map((t) => (
        <div key={t.id} style={{ marginBottom: 12 }}>
          <div>{t.title}</div>
          <div style={{ opacity: 0.6 }}>{t.status}</div>
        </div>
      ))}
    </main>
  );
}
