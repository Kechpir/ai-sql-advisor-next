import React, { useState } from "react";
import { Button } from "../ui/button";

interface WindowFunction {
  function: string;
  field: string;
  partitionBy: string;
  orderBy: string;
}

interface Subquery {
  alias: string;
  query: string;
}

interface JsonOperation {
  field: string;
  operator: string;
  path: string;
  alias: string;
}

interface DateLogic {
  field: string;
  condition: string;
  value: string;
}

interface QueryHint {
  engine: string;
  hint: string;
}

export default function ExpertSqlPanel({ schema, selectedTable, onChange }: any) {
  const [windowFunctions, setWindowFunctions] = useState<WindowFunction[]>([]);
  const [subqueries, setSubqueries] = useState<Subquery[]>([]);
  const [jsonOps, setJsonOps] = useState<JsonOperation[]>([]);
  const [dateLogic, setDateLogic] = useState<DateLogic[]>([]);
  const [queryHints, setQueryHints] = useState<QueryHint[]>([]);
  const [pagination, setPagination] = useState({ page: 1, pageSize: 50 });

  const updateParent = () => {
    onChange({
      windowFunctions,
      subqueries,
      jsonOps,
      dateLogic,
      queryHints,
      pagination,
    });
  };

  return (
    <div className="sql-builder-panel mt-10">
      <h2 className="panel-title text-purple-400">⚙️ Expert SQL Tools</h2>

      {/* WINDOW FUNCTIONS */}
      <div className="input-group">
        <label>🪟 Window Functions (RANK, ROW_NUMBER...)</label>
        {windowFunctions.map((w, i) => (
          <div key={i} className="field-row">
            <select
              value={w.function}
              onChange={(e) => {
                const updated = [...windowFunctions];
                updated[i].function = e.target.value;
                setWindowFunctions(updated);
                updateParent();
              }}
            >
              <option>ROW_NUMBER</option>
              <option>RANK</option>
              <option>DENSE_RANK</option>
              <option>NTILE</option>
            </select>
            <select
              value={w.field}
              onChange={(e) => {
                const updated = [...windowFunctions];
                updated[i].field = e.target.value;
                setWindowFunctions(updated);
                updateParent();
              }}
            >
              <option value="">— поле —</option>
              {schema?.[selectedTable]?.map((col: string) => (
                <option key={col} value={col}>
                  {col}
                </option>
              ))}
            </select>
            <input
              placeholder="PARTITION BY ..."
              value={w.partitionBy}
              onChange={(e) => {
                const updated = [...windowFunctions];
                updated[i].partitionBy = e.target.value;
                setWindowFunctions(updated);
                updateParent();
              }}
            />
            <input
              placeholder="ORDER BY ..."
              value={w.orderBy}
              onChange={(e) => {
                const updated = [...windowFunctions];
                updated[i].orderBy = e.target.value;
                setWindowFunctions(updated);
                updateParent();
              }}
            />
            <button
              className="delete-field-btn"
              onClick={() => {
                const updated = windowFunctions.filter((_, idx) => idx !== i);
                setWindowFunctions(updated);
                updateParent();
              }}
            >
              ✖
            </button>
          </div>
        ))}
        <Button
          onClick={() =>
            setWindowFunctions([
              ...windowFunctions,
              { function: "ROW_NUMBER", field: "", partitionBy: "", orderBy: "" },
            ])
          }
        >
          ➕ Добавить Window
        </Button>
      </div>

      {/* SUBQUERIES */}
      <div className="input-group">
        <label>🌀 Подзапросы (Subqueries):</label>
        {subqueries.map((s, i) => (
          <div key={i} className="field-row">
            <input
              placeholder="Алиас"
              value={s.alias}
              onChange={(e) => {
                const updated = [...subqueries];
                updated[i].alias = e.target.value;
                setSubqueries(updated);
                updateParent();
              }}
            />
            <textarea
              placeholder="SELECT ... FROM ..."
              value={s.query}
              onChange={(e) => {
                const updated = [...subqueries];
                updated[i].query = e.target.value;
                setSubqueries(updated);
                updateParent();
              }}
              style={{ width: "100%", minHeight: "60px" }}
            />
            <button
              className="delete-field-btn"
              onClick={() => {
                const updated = subqueries.filter((_, idx) => idx !== i);
                setSubqueries(updated);
                updateParent();
              }}
            >
              ✖
            </button>
          </div>
        ))}
        <Button
          onClick={() =>
            setSubqueries([...subqueries, { alias: "", query: "" }])
          }
        >
          ➕ Добавить Subquery
        </Button>
      </div>

      {/* JSON OPERATIONS */}
      <div className="input-group">
        <label>📦 JSON Операции:</label>
        {jsonOps.map((j, i) => (
          <div key={i} className="field-row">
            <select
              value={j.field}
              onChange={(e) => {
                const updated = [...jsonOps];
                updated[i].field = e.target.value;
                setJsonOps(updated);
                updateParent();
              }}
            >
              <option value="">— JSON поле —</option>
              {schema?.[selectedTable]?.map((col: string) => (
                <option key={col} value={col}>
                  {col}
                </option>
              ))}
            </select>
            <select
              value={j.operator}
              onChange={(e) => {
                const updated = [...jsonOps];
                updated[i].operator = e.target.value;
                setJsonOps(updated);
                updateParent();
              }}
            >
              <option value=">=">&gt;=</option>
              <option value="<=">&lt;=</option>

              <option>JSON_EXTRACT</option>
            </select>
            <input
              placeholder="путь (например, name->>'first')"
              value={j.path}
              onChange={(e) => {
                const updated = [...jsonOps];
                updated[i].path = e.target.value;
                setJsonOps(updated);
                updateParent();
              }}
            />
            <input
              placeholder="алиас"
              value={j.alias}
              onChange={(e) => {
                const updated = [...jsonOps];
                updated[i].alias = e.target.value;
                setJsonOps(updated);
                updateParent();
              }}
            />
            <button
              className="delete-field-btn"
              onClick={() => {
                const updated = jsonOps.filter((_, idx) => idx !== i);
                setJsonOps(updated);
                updateParent();
              }}
            >
              ✖
            </button>
          </div>
        ))}
        <Button
          onClick={() =>
            setJsonOps([...jsonOps, { field: "", operator: "->", path: "", alias: "" }])
          }
        >
          ➕ Добавить JSON-операцию
        </Button>
      </div>

      {/* DATE LOGIC */}
      <div className="input-group">
        <label>📅 Дата / Интервалы:</label>
        {dateLogic.map((d, i) => (
          <div key={i} className="field-row">
            <select
              value={d.field}
              onChange={(e) => {
                const updated = [...dateLogic];
                updated[i].field = e.target.value;
                setDateLogic(updated);
                updateParent();
              }}
            >
              <option value="">— поле —</option>
              {schema?.[selectedTable]?.map((col: string) => (
                <option key={col} value={col}>
                  {col}
                </option>
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
            >
              <option>BETWEEN</option>
              <option>&gt;=</option>
              <option>&lt;=</option>
            </select>
            <input
              placeholder="например NOW() - INTERVAL '7 days'"
              value={d.value}
              onChange={(e) => {
                const updated = [...dateLogic];
                updated[i].value = e.target.value;
                setDateLogic(updated);
                updateParent();
              }}
            />
            <button
              className="delete-field-btn"
              onClick={() => {
                const updated = dateLogic.filter((_, idx) => idx !== i);
                setDateLogic(updated);
                updateParent();
              }}
            >
              ✖
            </button>
          </div>
        ))}
        <Button
          onClick={() =>
            setDateLogic([...dateLogic, { field: "", condition: "BETWEEN", value: "" }])
          }
        >
          ➕ Добавить условие по дате
        </Button>
      </div>

      {/* QUERY HINTS */}
      <div className="input-group">
        <label>💡 Query Hints (подсказки для оптимизатора):</label>
        {queryHints.map((h, i) => (
          <div key={i} className="field-row">
            <select
              value={h.engine}
              onChange={(e) => {
                const updated = [...queryHints];
                updated[i].engine = e.target.value;
                setQueryHints(updated);
                updateParent();
              }}
            >
              <option>PostgreSQL</option>
              <option>MySQL</option>
              <option>Oracle</option>
              <option>SQL Server</option>
            </select>
            <input
              placeholder="пример: /*+ INDEX(table idx_customer_name) */"
              value={h.hint}
              onChange={(e) => {
                const updated = [...queryHints];
                updated[i].hint = e.target.value;
                setQueryHints(updated);
                updateParent();
              }}
            />
            <button
              className="delete-field-btn"
              onClick={() => {
                const updated = queryHints.filter((_, idx) => idx !== i);
                setQueryHints(updated);
                updateParent();
              }}
            >
              ✖
            </button>
          </div>
        ))}
        <Button
          onClick={() =>
            setQueryHints([...queryHints, { engine: "PostgreSQL", hint: "" }])
          }
        >
          ➕ Добавить Hint
        </Button>
      </div>

      {/* PAGINATION */}
      <div className="input-group flex gap-4 items-center justify-between">
        <label>📄 Пагинация:</label>
        <div>
          <Button
            disabled={pagination.page <= 1}
            onClick={() => {
              const newPage = pagination.page - 1;
              setPagination({ ...pagination, page: newPage });
              updateParent();
            }}
          >
            ◀ Prev
          </Button>
          <span className="mx-3 text-cyan-400">
            Страница {pagination.page}
          </span>
          <Button
            onClick={() => {
              const newPage = pagination.page + 1;
              setPagination({ ...pagination, page: newPage });
              updateParent();
            }}
          >
            Next ▶
          </Button>
        </div>
        <input
          type="number"
          value={pagination.pageSize}
          onChange={(e) => {
            setPagination({ ...pagination, pageSize: Number(e.target.value) });
            updateParent();
          }}
          style={{ width: "80px" }}
          placeholder="page size"
        />
      </div>
    </div>
  );
}
