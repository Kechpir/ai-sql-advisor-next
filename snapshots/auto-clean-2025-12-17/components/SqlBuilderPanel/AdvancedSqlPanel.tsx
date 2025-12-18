import React, { useState, useEffect } from "react";

interface Props {
  schema: any;
  onChange: (queryData: any) => void;
}

export default function AdvancedSqlPanel({ schema, onChange }: Props) {
  const [joins, setJoins] = useState<
    { type: string; table: string; field1: string; field2: string }[]
  >([]);
  const [groupBy, setGroupBy] = useState<string[]>([]);
  const [having, setHaving] = useState("");
  const [distinct, setDistinct] = useState(false);
  const [caseWhen, setCaseWhen] = useState("");
  const [union, setUnion] = useState("");

  useEffect(() => {
    onChange({ joins, groupBy, having, distinct, caseWhen, union });
  }, [joins, groupBy, having, distinct, caseWhen, union]);

  const addJoin = () =>
    setJoins([...joins, { type: "INNER", table: "", field1: "", field2: "" }]);
  const removeJoin = (i: number) => setJoins(joins.filter((_, idx) => idx !== i));

  const getColumns = (table: string) => (table && schema?.[table]) || [];

  return (
    <div className="main-card">
      <h3 style={{ color: "#3b82f6" }}>🧩 Расширенные SQL операции</h3>

      {/* DISTINCT */}
      <label className="checkbox">
        <input
          type="checkbox"
          checked={distinct}
          onChange={(e) => setDistinct(e.target.checked)}
        />{" "}
        DISTINCT
      </label>

      {/* JOIN */}
      <h4 style={{ marginTop: "1rem" }}>🔗 JOIN</h4>
      {joins.map((j, i) => (
        <div key={i} style={{ display: "flex", flexDirection: "column", gap: "0.5rem", marginBottom: "1rem" }}>
          <div style={{ display: "flex", gap: "0.5rem" }}>
            <select
              value={j.type}
              onChange={(e) => {
                const updated = [...joins];
                updated[i].type = e.target.value;
                setJoins(updated);
              }}
            >
              {["INNER", "LEFT", "RIGHT", "FULL"].map((t) => (
                <option key={t}>{t}</option>
              ))}
            </select>

            <select
              value={j.table}
              onChange={(e) => {
                const updated = [...joins];
                updated[i].table = e.target.value;
                setJoins(updated);
              }}
            >
              <option value="">— таблица —</option>
              {Object.keys(schema || {}).map((t) => (
                <option key={t}>{t}</option>
              ))}
            </select>

            <button className="btn btn-sec" onClick={() => removeJoin(i)}>
              ❌
            </button>
          </div>

          <div style={{ display: "flex", gap: "0.5rem" }}>
            <select
              value={j.field1}
              onChange={(e) => {
                const updated = [...joins];
                updated[i].field1 = e.target.value;
                setJoins(updated);
              }}
            >
              <option value="">— поле 1 —</option>
              {Object.keys(schema || {}).flatMap((t) =>
                schema[t]?.map((col: string) => (
                  <option key={`${t}.${col}`}>{`${t}.${col}`}</option>
                ))
              )}
            </select>

            <select
              value={j.field2}
              onChange={(e) => {
                const updated = [...joins];
                updated[i].field2 = e.target.value;
                setJoins(updated);
              }}
            >
              <option value="">— поле 2 —</option>
              {getColumns(j.table).map((col: string) => (
                <option key={col}>{col}</option>
              ))}
            </select>
          </div>
        </div>
      ))}
      <button className="btn btn-main" onClick={addJoin}>
        ➕ Добавить JOIN
      </button>

      {/* GROUP BY */}
      <h4 style={{ marginTop: "1.5rem" }}>📊 GROUP BY</h4>
      {groupBy.map((g, i) => (
        <div key={i} style={{ display: "flex", gap: "0.5rem", marginBottom: "0.5rem" }}>
          <input
            value={g}
            onChange={(e) => {
              const updated = [...groupBy];
              updated[i] = e.target.value;
              setGroupBy(updated);
            }}
            placeholder="Поле или выражение"
          />
          <button className="btn btn-sec" onClick={() => setGroupBy(groupBy.filter((_, idx) => idx !== i))}>
            ❌
          </button>
        </div>
      ))}
      <button className="btn btn-main" onClick={() => setGroupBy([...groupBy, ""])}>
        ➕ Добавить поле GROUP
      </button>

      {/* HAVING */}
      <h4 style={{ marginTop: "1rem" }}>🧮 HAVING</h4>
      <textarea
        placeholder="например COUNT(id) > 5"
        value={having}
        onChange={(e) => setHaving(e.target.value)}
      />

      {/* CASE WHEN */}
      <h4 style={{ marginTop: "1rem" }}>⚖ CASE WHEN</h4>
      <textarea
        placeholder="CASE WHEN condition THEN result ELSE other END"
        value={caseWhen}
        onChange={(e) => setCaseWhen(e.target.value)}
      />

      {/* UNION */}
      <h4 style={{ marginTop: "1rem" }}>🔀 UNION / UNION ALL</h4>
      <textarea
        placeholder="SELECT id, name FROM users UNION SELECT id, name FROM customers"
        value={union}
        onChange={(e) => setUnion(e.target.value)}
      />
    </div>
  );
}
