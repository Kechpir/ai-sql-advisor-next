import React from "react";

interface PanelProps {
  title?: string;
  children: React.ReactNode;
  compact?: boolean;
}

export default function Panel({ title, children, compact = false }: PanelProps) {
  return (
    <div className={`panel ${compact ? "panel-compact" : ""}`}>
      {title && <h2 className="panel-title">{title}</h2>}
      <div className="panel-body">{children}</div>
    </div>
  );
}
