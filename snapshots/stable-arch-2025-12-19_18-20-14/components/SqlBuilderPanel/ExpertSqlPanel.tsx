import React, { useState, useEffect } from "react";

interface Props {
  onChange: (data: any) => void;
  schema?: any;
  selectedTable?: string;
}

export default function ExpertSqlPanel({ onChange }: Props) {
  const [cte, setCte] = useState("");
  const [recursive, setRecursive] = useState(false);
  const [windowFunctions, setWindowFunctions] = useState<string[]>([]);
  const [jsonOps, setJsonOps] = useState<string[]>([]);
  const [subqueries, setSubqueries] = useState<string[]>([]);
  const [dateLogic, setDateLogic] = useState("");
  const [queryHints, setQueryHints] = useState("");
  const [pagination, setPagination] = useState({ limit: "", offset: "" });

  useEffect(() => {
    onChange({
      cte,
      recursive,
      windowFunctions,
      jsonOps,
      subqueries,
      dateLogic,
      queryHints,
      pagination,
    });
  }, [
    cte,
    recursive,
    windowFunctions,
    jsonOps,
    subqueries,
    dateLogic,
    queryHints,
    pagination,
  ]);

  return (
    <div className="main-card">
      <h3 style={{ color: "#22d3ee" }}>🧬 Expert SQL — Продвинутая логика</h3>

      {/* === CTE === */}
      <h4 style={{ marginTop: "1rem" }}>🔷 WITH / CTE</h4>
      <label className="checkbox">
        <input
          type="checkbox"
          checked={recursive}
          onChange={(e) => setRecursive(e.target.checked)}
        />{" "}
        WITH RECURSIVE
      </label>
      <textarea
        placeholder="WITH cte_name AS (SELECT * FROM users)"
        value={cte}
        onChange={(e) => setCte(e.target.value)}
      />

      {/* === WINDOW FUNCTIONS === */}
      <h4 style={{ marginTop: "1rem" }}>📊 Window Functions</h4>
      {windowFunctions.map((f, i) => (
        <div key={i} style={{ display: "flex", gap: "0.5rem", marginBottom: "0.5rem" }}>
          <input
            value={f}
            onChange={(e) => {
              const updated = [...windowFunctions];
              updated[i] = e.target.value;
              setWindowFunctions(updated);
            }}
            placeholder="ROW_NUMBER() OVER (PARTITION BY ...)"
          />
          <button
            className="btn btn-sec"
            onClick={() => setWindowFunctions(windowFunctions.filter((_, idx) => idx !== i))}
          >
            ❌
          </button>
        </div>
      ))}
      <button className="btn btn-main" onClick={() => setWindowFunctions([...windowFunctions, ""])}>
        ➕ Добавить Window
      </button>

      {/* === SUBQUERIES === */}
      <h4 style={{ marginTop: "1rem" }}>🌀 Subqueries</h4>
      {subqueries.map((q, i) => (
        <div key={i} style={{ display: "flex", gap: "0.5rem", marginBottom: "0.5rem" }}>
          <textarea
            value={q}
            onChange={(e) => {
              const updated = [...subqueries];
              updated[i] = e.target.value;
              setSubqueries(updated);
            }}
            placeholder="(SELECT id FROM orders WHERE total > 100)"
          />
          <button
            className="btn btn-sec"
            onClick={() => setSubqueries(subqueries.filter((_, idx) => idx !== i))}
          >
            ❌
          </button>
        </div>
      ))}
      <button className="btn btn-main" onClick={() => setSubqueries([...subqueries, ""])}>
        ➕ Добавить подзапрос
      </button>

      {/* === JSON Operations === */}
      <h4 style={{ marginTop: "1rem" }}>📦 JSON Operations</h4>
      {jsonOps.map((j, i) => (
        <div key={i} style={{ display: "flex", gap: "0.5rem", marginBottom: "0.5rem" }}>
          <input
            value={j}
            onChange={(e) => {
              const updated = [...jsonOps];
              updated[i] = e.target.value;
              setJsonOps(updated);
            }}
            placeholder="JSON_EXTRACT(data, '$.user.name')"
          />
          <button
            className="btn btn-sec"
            onClick={() => setJsonOps(jsonOps.filter((_, idx) => idx !== i))}
          >
            ❌
          </button>
        </div>
      ))}
      <button className="btn btn-main" onClick={() => setJsonOps([...jsonOps, ""])}>
        ➕ Добавить JSON
      </button>

      {/* === DATE / INTERVAL LOGIC === */}
      <h4 style={{ marginTop: "1rem" }}>⏳ Date / Interval Logic</h4>
      <textarea
        placeholder="NOW() - INTERVAL '7 days'"
        value={dateLogic}
        onChange={(e) => setDateLogic(e.target.value)}
      />

      {/* === QUERY HINTS === */}
      <h4 style={{ marginTop: "1rem" }}>💡 Query Hints / Optimizer</h4>
      <textarea
        placeholder="/*+ INDEX(users idx_name) */"
        value={queryHints}
        onChange={(e) => setQueryHints(e.target.value)}
      />

      {/* === PAGINATION === */}
      <h4 style={{ marginTop: "1rem" }}>📄 Pagination</h4>
      <div style={{ display: "flex", gap: "1rem" }}>
        <input
          type="number"
          placeholder="LIMIT"
          value={pagination.limit}
          onChange={(e) => setPagination({ ...pagination, limit: e.target.value })}
        />
        <input
          type="number"
          placeholder="OFFSET"
          value={pagination.offset}
          onChange={(e) => setPagination({ ...pagination, offset: e.target.value })}
        />
      </div>
    </div>
  );
}

