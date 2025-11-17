import React from "react";

interface PanelProps {
  title?: string;
  children: React.ReactNode;
  compact?: boolean;
}

export default function Panel({ title, children, compact = false }: PanelProps) {
  return (
    <div
      style={{
        background: "var(--panel)",
        border: "1px solid var(--border)",
        borderRadius: "1rem",
        padding: compact ? "1rem" : "1.5rem",
        marginBottom: "1.5rem",
        boxShadow: "0 0 12px rgba(34, 211, 238, 0.05)",
        transition: "all 0.2s ease",
      }}
      className="panel"
    >
      {title && (
        <h2
          style={{
            color: "var(--accent)",
            fontSize: "1rem",
            fontWeight: 600,
            marginBottom: "1rem",
            borderBottom: "1px solid var(--border)",
            paddingBottom: "0.4rem",
          }}
        >
          {title}
        </h2>
      )}

      <div>{children}</div>
    </div>
  );
}
