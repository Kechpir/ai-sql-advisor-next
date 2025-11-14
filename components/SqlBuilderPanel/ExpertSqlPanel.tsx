import React, { useState } from "react";
import { Button } from "../ui/button";
import { PanelWrapper } from "../ui/PanelWrapper";

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
  const [showSql, setShowSql] = useState(false);

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
    <PanelWrapper title="⚙️ Expert SQL Tools">
      {/* WINDOW FUNCTIONS */}
      <div className="input-group">
        <label>🪟 Window Functions (RANK, ROW_NUMBER...)</label>
        {windowFunctions.map((w, i) => (
          <div key={i} className="flex flex-wrap gap-2 mb-2">
            <select
              value={w.function}
              onChange={(e) => {
                const updated = [...windowFunctions];
                updated[i].function = e.target.value;
                setWindowFunctions(updated);
                updateParent();
              }}
              className="sql-input w-40"
            >
              {["ROW_NUMBER", "RANK", "DENSE_RANK", "NTILE"].map((fn) => (
                <option key={fn}>{fn}</option>
              ))}
            </select>

            <select
              value={w.field}
              onChange={(e) => {
                const updated = [...windowFunctions];
                updated[i].field = e.target.value;
                setWindowFunctions(updated);
                updateParent();
              }}
              className="sql-input w-40"
            >
              <option value="">— поле —</option>
              {schema?.[selectedTable]?.map((col: string) => (
                <option key={col}>{col}</option>
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
              className="sql-input flex-1"
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
              className="sql-input flex-1"
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
          className="add-btn text-sm"
        >
          ➕ Добавить Window
        </Button>
      </div>

      {/* SUBQUERIES */}
      <div className="input-group">
        <label>🌀 Подзапросы (Subqueries)</label>
        {subqueries.map((s, i) => (
          <div key={i} className="flex flex-col gap-2 mb-2">
            <input
              placeholder="Алиас"
              value={s.alias}
              onChange={(e) => {
                const updated = [...subqueries];
                updated[i].alias = e.target.value;
                setSubqueries(updated);
                updateParent();
              }}
              className="sql-input"
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
              className="sql-input min-h-[60px]"
            />
            <button
              className="delete-field-btn self-end"
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
          onClick={() => setSubqueries([...subqueries, { alias: "", query: "" }])}
          className="add-btn text-sm"
        >
          ➕ Добавить Subquery
        </Button>
      </div>

      {/* JSON OPERATIONS */}
      <div className="input-group">
        <label>📦 JSON Операции</label>
        {jsonOps.map((j, i) => (
          <div key={i} className="flex flex-wrap gap-2 mb-2">
            <select
              value={j.field}
              onChange={(e) => {
                const updated = [...jsonOps];
                updated[i].field = e.target.value;
                setJsonOps(updated);
                updateParent();
              }}
              className="sql-input w-40"
            >
              <option value="">— JSON поле —</option>
              {schema?.[selectedTable]?.map((col: string) => (
                <option key={col}>{col}</option>
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
              className="sql-input w-32"
            >
              {["->", "->>", "JSON_EXTRACT"].map((op) => (
                <option key={op}>{op}</option>
              ))}
            </select>

            <input
              placeholder="путь (name->>'first')"
              value={j.path}
              onChange={(e) => {
                const updated = [...jsonOps];
                updated[i].path = e.target.value;
                setJsonOps(updated);
                updateParent();
              }}
              className="sql-input flex-1"
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
              className="sql-input flex-1"
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
          className="add-btn text-sm"
        >
          ➕ Добавить JSON-операцию
        </Button>
      </div>

      {/* DATE LOGIC */}
      <div className="input-group">
        <label>📅 Дата / Интервалы</label>
        {dateLogic.map((d, i) => (
          <div key={i} className="flex flex-wrap gap-2 mb-2">
            <select
              value={d.field}
              onChange={(e) => {
                const updated = [...dateLogic];
                updated[i].field = e.target.value;
                setDateLogic(updated);
                updateParent();
              }}
              className="sql-input w-40"
            >
              <option value="">— поле —</option>
              {schema?.[selectedTable]?.map((col: string) => (
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
              className="sql-input w-32"
            >
              {["BETWEEN", ">=", "<="].map((op) => (
                <option key={op}>{op}</option>
              ))}
            </select>

            <input
              placeholder="NOW() - INTERVAL '7 days'"
              value={d.value}
              onChange={(e) => {
                const updated = [...dateLogic];
                updated[i].value = e.target.value;
                setDateLogic(updated);
                updateParent();
              }}
              className="sql-input flex-1"
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
          className="add-btn text-sm"
        >
          ➕ Добавить условие
        </Button>
      </div>

      {/* QUERY HINTS */}
      <div className="input-group">
        <label>💡 Query Hints</label>
        {queryHints.map((h, i) => (
          <div key={i} className="flex gap-2 mb-1 flex-wrap">
            <select
              value={h.engine}
              onChange={(e) => {
                const updated = [...queryHints];
                updated[i].engine = e.target.value;
                setQueryHints(updated);
                updateParent();
              }}
              className="sql-input w-40"
            >
              {["PostgreSQL", "MySQL", "Oracle", "SQL Server"].map((db) => (
                <option key={db}>{db}</option>
              ))}
            </select>
            <input
              placeholder="/*+ INDEX(table idx_name) */"
              value={h.hint}
              onChange={(e) => {
                const updated = [...queryHints];
                updated[i].hint = e.target.value;
                setQueryHints(updated);
                updateParent();
              }}
              className="sql-input flex-1"
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
          className="add-btn text-sm"
        >
          ➕ Добавить Hint
        </Button>
      </div>

      {/* PAGINATION */}
      <div className="input-group flex items-center justify-between border-t border-zinc-800 pt-4">
        <label>📄 Пагинация</label>
        <div>
          <Button
            disabled={pagination.page <= 1}
            onClick={() => {
              const newPage = pagination.page - 1;
              setPagination({ ...pagination, page: newPage });
              updateParent();
            }}
            className="text-sm px-3 py-1"
          >
            ◀ Prev
          </Button>
          <span className="mx-3 text-cyan-400">Стр. {pagination.page}</span>
          <Button
            onClick={() => {
              const newPage = pagination.page + 1;
              setPagination({ ...pagination, page: newPage });
              updateParent();
            }}
            className="text-sm px-3 py-1"
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
          className="sql-input w-[80px]"
          placeholder="page size"
        />
      </div>

      {/* SQL PREVIEW */}
      <div className="flex justify-end mt-3">
        <Button
          onClick={() => setShowSql(!showSql)}
          variant="ghost"
          className="add-btn show-sql text-sm"
        >
          {showSql ? "Скрыть SQL" : "Показать SQL"}
        </Button>
      </div>

      {showSql && (
        <div className="sql-output bg-zinc-950 border border-zinc-800 rounded-xl p-3 mt-3 text-xs text-gray-300 font-mono overflow-x-auto">
          Здесь появится SQL для Expert уровня.
        </div>
      )}
    </PanelWrapper>
  );
}
