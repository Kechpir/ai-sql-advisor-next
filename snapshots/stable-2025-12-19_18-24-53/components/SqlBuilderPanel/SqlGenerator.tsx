import React, { useState } from "react";

interface SqlGeneratorProps {
  sqlParts: Record<string, any>;
  selectedTable: string;
  onExecute: (sql: string) => void;
}

export default function SqlGenerator({ sqlParts, selectedTable, onExecute }: SqlGeneratorProps) {
  const [generatedSQL, setGeneratedSQL] = useState("");

  const buildSQL = () => {
    let sql = "";

    // === SELECT ===
    if (sqlParts.fields?.length > 0) {
      sql += `SELECT ${sqlParts.distinct ? "DISTINCT " : ""}${sqlParts.fields.join(", ")} FROM ${selectedTable}`;
    } else {
      sql += `SELECT * FROM ${selectedTable}`;
    }

    // === JOIN ===
    if (sqlParts.joins?.length) {
      sql += "\n" + sqlParts.joins.map((j: any) => j.text).join("\n");
    }

    // === WHERE ===
    if (sqlParts.filters?.length) {
      const where = sqlParts.filters.map((f: any) => f.text).join(" AND ");
      sql += `\nWHERE ${where}`;
    }

    // === GROUP / HAVING ===
    if (sqlParts.groupBy?.length) sql += `\nGROUP BY ${sqlParts.groupBy.join(", ")}`;
    if (sqlParts.having) sql += `\nHAVING ${sqlParts.having}`;

    // === WINDOW ===
    if (sqlParts.windowFunctions) sql += `\n${sqlParts.windowFunctions}`;

    // === CASE WHEN ===
    if (sqlParts.caseWhen) sql += `\n${sqlParts.caseWhen}`;

    // === UNION ===
    if (sqlParts.union) sql += `\n${sqlParts.union}`;

    // === CTE ===
    if (sqlParts.cte) {
      sql = `${sqlParts.recursive ? "WITH RECURSIVE" : "WITH"} ${sqlParts.cte} ${sql}`;
    }

    // === JSON / DATE ===
    if (sqlParts.jsonOps) sql += `\n-- JSON Ops: ${sqlParts.jsonOps}`;
    if (sqlParts.dateLogic) sql += `\n-- Date Logic: ${sqlParts.dateLogic}`;

    // === QUERY HINTS ===
    if (sqlParts.queryHints) sql = `${sqlParts.queryHints}\n${sql}`;

    // === LIMIT / OFFSET ===
    if (sqlParts.limit) sql += `\nLIMIT ${sqlParts.limit}`;
    if (sqlParts.offset) sql += ` OFFSET ${sqlParts.offset}`;

    // === TRANSACTION ===
    if (sqlParts.transaction) sql = `${sqlParts.transaction};\n${sql}`;

    // === Завершаем ===
    sql += ";";
    setGeneratedSQL(sql);
  };

  return (
    <div className="sql-builder-panel">
      <h2 className="section-title">🧠 SQL Генератор</h2>

      <div className="flex gap-3 mb-3">
        <button className="add-btn" onClick={buildSQL}>
          ⚡ Сгенерировать SQL
        </button>
        <button
          className="execute-btn"
          disabled={!generatedSQL}
          onClick={() => onExecute(generatedSQL)}
        >
          ▶️ Выполнить SQL
        </button>
      </div>

      {generatedSQL && (
        <pre className="sql-output mt-3">
          {generatedSQL}
        </pre>
      )}
    </div>
  );
}