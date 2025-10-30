import React from "react";

interface SqlDialectSelectProps {
  dialect: string;
  onChange: (value: string) => void;
}

const SQL_DIALECTS = [
  { label: "PostgreSQL", value: "postgres" },
  { label: "MySQL", value: "mysql" },
  { label: "SQLite", value: "sqlite" },
  { label: "Microsoft SQL Server", value: "mssql" },
  { label: "Oracle SQL", value: "oracle" },
  { label: "MariaDB", value: "mariadb" },
  { label: "DuckDB", value: "duckdb" },
  { label: "Snowflake", value: "snowflake" },
];

export const SqlDialectSelect: React.FC<SqlDialectSelectProps> = ({
  dialect,
  onChange,
}) => {
  return (
    <div className="mt-3">
      <label className="block text-sm font-medium mb-1">
        Выбери SQL-диалект
      </label>
      <select
        className="w-full border rounded-xl p-2 text-sm"
        value={dialect}
        onChange={(e) => onChange(e.target.value)}
      >
        {SQL_DIALECTS.map((d) => (
          <option key={d.value} value={d.value}>
            {d.label}
          </option>
        ))}
      </select>
    </div>
  );
};
