import React, { useState } from "react";

interface Props {
  schema: Record<string, string[]>;
  selectedTable: string;
  onChange: (data: any) => void;
}

export default function ExpertSqlPanel({ schema, selectedTable, onChange }: Props) {
  const [windowFunctions, setWindowFunctions] = useState<any[]>([]);
  const [jsonOps, setJsonOps] = useState<any[]>([]);
  const [dateLogic, setDateLogic] = useState<any[]>([]);
  const [queryHints, setQueryHints] = useState<any[]>([]);
  const [pagination, setPagination] = useState({ page: 1, pageSize: 50 });

  const updateParent = () => {
    onChange({ windowFunctions, jsonOps, dateLogic, queryHints, pagination });
  };

  return (
    <div className="expert-panel">
      <h3 className="section-title">👑 Экспертные SQL инструменты</h3>

      {/* === LEFT COLUMN === */}
      <div className="section-grid">
        {/* WINDOW FUNCTIONS */}
        <div className="expert-block">
          <label className="block-label">🪟 Window Functions</label>
          {windowFunctions.map((fn, i) => (
            <div key={i} className="row">
              <select
                value={fn.function}
                onChange={(e) => {
                  const updated = [...windowFunctions];
                  updated[i].function = e.target.value;
                  setWindowFunctions(updated);
                  updateParent();
                }}
                className="sql-input small"
              >
                {["ROW_NUMBER", "RANK", "DENSE_RANK", "SUM OVER", "AVG OVER"].map((f) => (
                  <option key={f}>{f}</option>
                ))}
              </select>

              <select
                value={fn.field}
                onChange={(e) => {
                  const updated = [...windowFunctions];
                  updated[i].field = e.target.value;
                  setWindowFunctions(updated);
                  updateParent();
                }}
                className="sql-input small"
              >
                <option value="">— поле —</option>
                {schema?.[selectedTable]?.map((col) => (
                  <option key={col}>{col}</option>
                ))}
              </select>

              <button
                className="btn btn-danger"
                onClick={() => {
                  setWindowFunctions(windowFunctions.filter((_, idx) => idx !== i));
                  updateParent();
                }}
              >
                ✖
              </button>
            </div>
          ))}
          <button
            className="btn btn-ghost small"
            onClick={() =>
              setWindowFunctions([
                ...windowFunctions,
                { function: "ROW_NUMBER", field: "" },
              ])
            }
          >
            ➕ Добавить Window
          </button>
        </div>

        {/* JSON OPS */}
        <div className="expert-block">
          <label className="block-label">📦 JSON операции</label>
          {jsonOps.map((op, i) => (
            <div key={i} className="row">
              <select
                value={op.field}
                onChange={(e) => {
                  const updated = [...jsonOps];
                  updated[i].field = e.target.value;
                  setJsonOps(updated);
                  updateParent();
                }}
                className="sql-input small"
              >
                <option value="">— JSON поле —</option>
                {schema?.[selectedTable]?.map((col) => (
                  <option key={col}>{col}</option>
                ))}
              </select>

              <select
                value={op.operator}
                onChange={(e) => {
                  const updated = [...jsonOps];
                  updated[i].operator = e.target.value;
                  setJsonOps(updated);
                  updateParent();
                }}
                className="sql-input small"
              >
                {["->", "->>", "JSON_EXTRACT"].map((f) => (
                  <option key={f}>{f}</option>
                ))}
              </select>

              <input
                value={op.path}
                onChange={(e) => {
                  const updated = [...jsonOps];
                  updated[i].path = e.target.value;
                  setJsonOps(updated);
                  updateParent();
                }}
                placeholder="путь (например: name->>'first')"
                className="sql-input small"
              />

              <button
                className="btn btn-danger"
                onClick={() => {
                  setJsonOps(jsonOps.filter((_, idx) => idx !== i));
                  updateParent();
                }}
              >
                ✖
              </button>
            </div>
          ))}
          <button
            className="btn btn-ghost small"
            onClick={() =>
              setJsonOps([...jsonOps, { field: "", operator: "->", path: "" }])
            }
          >
            ➕ Добавить JSON
          </button>
        </div>
      </div>

      {/* === RIGHT COLUMN === */}
      <div className="section-grid">
        {/* DATE LOGIC */}
        <div className="expert-block">
          <label className="block-label">📅 Логика по дате</label>
          {dateLogic.map((d, i) => (
            <div key={i} className="row">
              <select
                value={d.field}
                onChange={(e) => {
                  const updated = [...dateLogic];
                  updated[i].field = e.target.value;
                  setDateLogic(updated);
                  updateParent();
                }}
                className="sql-input small"
              >
                <option value="">— поле —</option>
                {schema?.[selectedTable]?.map((col) => (
                  <option key={col}>{col}</option>
                ))}
              </select>

              <select
                value={d.condition}
                onChange={(e) => {
                  const updated = [...dateLogic];
                  updated[i].condition = e.target.value;
                  setDateLogic(updated);
                  updateParent();
                }}
                className="sql-input small"
              >
                {["BETWEEN", ">=", "<=", "="].map((f) => (
                  <option key={f}>{f}</option>
                ))}
              </select>

              <input
                value={d.value}
                onChange={(e) => {
                  const updated = [...dateLogic];
                  updated[i].value = e.target.value;
                  setDateLogic(updated);
                  updateParent();
                }}
                placeholder="NOW() - INTERVAL '7 days'"
                className="sql-input small"
              />

              <button
                className="btn btn-danger"
                onClick={() => {
                  setDateLogic(dateLogic.filter((_, idx) => idx !== i));
                  updateParent();
                }}
              >
                ✖
              </button>
            </div>
          ))}
          <button
            className="btn btn-ghost small"
            onClick={() =>
              setDateLogic([...dateLogic, { field: "", condition: ">=", value: "" }])
            }
          >
            ➕ Добавить дату
          </button>
        </div>

        {/* QUERY HINTS */}
        <div className="expert-block">
          <label className="block-label">💡 Query Hints</label>
          {queryHints.map((h, i) => (
            <div key={i} className="row">
              <select
                value={h.engine}
                onChange={(e) => {
                  const updated = [...queryHints];
                  updated[i].engine = e.target.value;
                  setQueryHints(updated);
                  updateParent();
                }}
                className="sql-input small"
              >
                {["PostgreSQL", "MySQL", "Oracle", "SQL Server"].map((db) => (
                  <option key={db}>{db}</option>
                ))}
              </select>

              <input
                value={h.hint}
                onChange={(e) => {
                  const updated = [...queryHints];
                  updated[i].hint = e.target.value;
                  setQueryHints(updated);
                  updateParent();
                }}
                placeholder="/*+ INDEX(users idx_name) */"
                className="sql-input small"
              />

              <button
                className="btn btn-danger"
                onClick={() => {
                  setQueryHints(queryHints.filter((_, idx) => idx !== i));
                  updateParent();
                }}
              >
                ✖
              </button>
            </div>
          ))}
          <button
            className="btn btn-ghost small"
            onClick={() =>
              setQueryHints([...queryHints, { engine: "PostgreSQL", hint: "" }])
            }
          >
            ➕ Добавить Hint
          </button>
        </div>
      </div>

      {/* PAGINATION */}
      <div className="expert-block mt-3">
        <label className="block-label">📄 Пагинация</label>
        <div className="flex items-center gap-2">
          <button
            className="btn btn-ghost small"
            disabled={pagination.page <= 1}
            onClick={() => {
              setPagination({ ...pagination, page: pagination.page - 1 });
              updateParent();
            }}
          >
            ◀
          </button>
          <span>Стр. {pagination.page}</span>
          <button
            className="btn btn-ghost small"
            onClick={() => {
              setPagination({ ...pagination, page: pagination.page + 1 });
              updateParent();
            }}
          >
            ▶
          </button>
          <input
            type="number"
            value={pagination.pageSize}
            onChange={(e) => {
              setPagination({ ...pagination, pageSize: Number(e.target.value) });
              updateParent();
            }}
            className="sql-input small w-20"
          />
        </div>
      </div>
    </div>
  );
}
