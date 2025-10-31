import { useEffect, useState } from "react";

const DIALECTS = [
  { value: "postgres", label: "PostgreSQL" },
  { value: "mysql", label: "MySQL" },
  { value: "sqlite", label: "SQLite" },
  { value: "mssql", label: "SQL Server" },
  { value: "oracle", label: "Oracle SQL" },
  { value: "snowflake", label: "Snowflake" },
  { value: "bigquery", label: "BigQuery" },
  { value: "redshift", label: "Amazon Redshift" },
];

export default function SqlDialectSelect({
  value,
  onChange,
}: {
  value?: string;
  onChange: (val: string) => void;
}) {
  const [selected, setSelected] = useState<string>("");

  useEffect(() => {
    const saved = localStorage.getItem("preferred_dialect");
    if (saved) {
      setSelected(saved);
      onChange(saved);
    }
  }, []);

  const handleChange = (val: string) => {
    setSelected(val);
    onChange(val);
    localStorage.setItem("preferred_dialect", val);
  };

  return (
    <div style={{ display: "grid", gap: 6 }}>
      <label
        style={{
          color: "#9ca3af",
          fontSize: 13,
          fontWeight: 500,
          marginLeft: 2,
        }}
      >
        Выберите SQL-диалект
      </label>

      <div style={{ position: "relative" }}>
        <select
          value={selected}
          onChange={(e) => handleChange(e.target.value)}
          style={{
            background: "#0b1220",
            color: selected ? "#e5e7eb" : "#6b7280",
            border: "1px solid #1f2937",
            borderRadius: 12,
            padding: "10px 38px 10px 12px",
            width: "100%",
            appearance: "none",
            fontWeight: 500,
            fontSize: 14,
            cursor: "pointer",
            transition: "border-color 0.2s ease",
          }}
        >
          <option value="" disabled>
            — Выберите диалект SQL —
          </option>
          {DIALECTS.map((d) => (
            <option key={d.value} value={d.value}>
              {d.label}
            </option>
          ))}
        </select>

        {/* Аккуратная стрелка */}
        <span
          style={{
            position: "absolute",
            right: 14,
            top: "50%",
            transform: "translateY(-50%)",
            color: "#9ca3af",
            fontSize: 12,
            pointerEvents: "none",
          }}
        >
          ▼
        </span>
      </div>
    </div>
  );
}
