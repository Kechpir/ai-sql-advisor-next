import React, { useState } from "react";

export default function SidebarMenu() {
  const [active, setActive] = useState("basic");

  const sections = [
    { key: "basic", label: "🧩 Основные операции" },
    { key: "advanced", label: "⚙️ Расширенные запросы" },
    { key: "expert", label: "🧠 Экспертные инструменты" },
  ];

  const handleClick = (key: string) => {
    setActive(key);
    const target = document.getElementById(key);
    if (target) target.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  return (
    <div>
      <h2
        style={{
          color: "var(--accent)",
          fontSize: "1.1rem",
          fontWeight: 600,
          marginBottom: "1rem",
        }}
      >
        ⚡ SQL Панель
      </h2>

      <div style={{ display: "flex", flexDirection: "column", gap: "0.4rem" }}>
        {sections.map((s) => (
          <button
            key={s.key}
            onClick={() => handleClick(s.key)}
            style={{
              background:
                active === s.key ? "rgba(34, 211, 238, 0.15)" : "transparent",
              border: "none",
              color: active === s.key ? "var(--accent)" : "var(--text-dim)",
              textAlign: "left",
              padding: "0.6rem 0.8rem",
              borderRadius: "var(--radius)",
              cursor: "pointer",
              fontWeight: 500,
              transition: "var(--transition)",
            }}
          >
            {s.label}
          </button>
        ))}
      </div>

      <div style={{ borderTop: "1px solid var(--border)", margin: "1rem 0" }} />

      <div style={{ display: "flex", flexDirection: "column", gap: "0.4rem" }}>
        <h3
          style={{
            color: "var(--text-dim)",
            fontSize: "0.9rem",
            fontWeight: 600,
            marginBottom: "0.3rem",
          }}
        >
          🔒 Транзакции
        </h3>
        <button className="btn btn-ghost">🔹 BEGIN</button>
        <button className="btn btn-primary">✅ COMMIT</button>
        <button className="btn btn-danger">⛔ ROLLBACK</button>
      </div>
    </div>
  );
}
