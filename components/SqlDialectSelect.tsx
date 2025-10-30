// components/SqlDialectSelect.tsx
import { useState } from "react";

export default function SqlDialectSelect({
  value,
  onChange,
}: {
  value: string;
  onChange: (val: string) => void;
}) {
  const dialects = [
    "postgres",
    "mysql",
    "sqlite",
    "mssql",
    "oracle",
    "mariadb",
    "snowflake",
    "redshift",
  ];

  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      style={{
        background: "#0b1220",
        color: "#e5e7eb",
        border: "1px solid #1f2937",
        borderRadius: 12,
        padding: "10px 12px",
      }}
    >
      {dialects.map((d) => (
        <option key={d} value={d}>
          {d.toUpperCase()}
        </option>
      ))}
    </select>
  );
}
