import React, { useState } from "react";
import { Button } from "../ui/button";
import PanelWrapper from "@/components/ui/PanelWrapper";

interface AggregateField {
  function: string;
  field: string;
  alias: string;
}

interface CaseWhen {
  condition: string;
  result: string;
}

interface Cte {
  name: string;
  query: string;
}

interface UnionQuery {
  type: "UNION" | "UNION ALL";
  query: string;
}

export default function AdvancedSqlPanel({
  schema,
  selectedTable,
  onChange,
}: any) {
  const [distinct, setDistinct] = useState(false);
  const [groupBy, setGroupBy] = useState<string[]>([]);
  const [having, setHaving] = useState<string>("");
  const [aggregates, setAggregates] = useState<AggregateField[]>([]);
  const [caseWhenList, setCaseWhenList] = useState<CaseWhen[]>([]);
  const [ctes, setCtes] = useState<Cte[]>([]);
  const [unions, setUnions] = useState<UnionQuery[]>([]);
  const [expressions, setExpressions] = useState<string[]>([]);
  const [showSql, setShowSql] = useState(false);

  const updateParent = () => {
    onChange({
      distinct,
      groupBy,
      having,
      aggregates,
      caseWhenList,
      ctes,
      unions,
      expressions,
    });
  };

  return (
    <PanelWrapper title="🧩 Расширенные SQL-компоненты">
      {/* DISTINCT */}
      <div className="input-group flex items-center gap-3 mb-3">
        <label className="flex items-center gap-2 cursor-pointer text-[0.9rem] text-gray-200">
          <input
            type="checkbox"
            className="distinct-checkbox accent-cyan-400"
            checked={distinct}
            onChange={(e) => {
              setDistinct(e.target.checked);
              updateParent();
            }}
          />
          DISTINCT
        </label>
      </div>

      {/* GROUP BY */}
      <div className="input-group mb-4">
        <label>📊 GROUP BY</label>
        {groupBy.map((g, i) => (
          <div key={i} className="flex gap-2 mb-1">
            <select
              value={g}
              onChange={(e) => {
                const updated = [...groupBy];
                updated[i] = e.target.value;
                setGroupBy(updated);
                updateParent();
              }}
              className="bg-zinc-950 border border-zinc-800 rounded-lg px-3 py-2 w-full"
            >
              <option value="">— выбрать поле —</option>
              {schema?.[selectedTable]?.map((col: string) => (
                <option key={col}>{col}</option>
              ))}
            </select>
            <button
              className="delete-field-btn"
              onClick={() => {
                const updated = groupBy.filter((_, idx) => idx !== i);
                setGroupBy(updated);
                updateParent();
              }}
            >
              ✖
            </button>
          </div>
        ))}
        <Button
          onClick={() => {
            setGroupBy([...groupBy, ""]);
            updateParent();
          }}
          className="add-btn text-sm px-3 py-1.5"
        >
          ➕ Добавить GROUP
        </Button>
      </div>

      {/* HAVING */}
      <div className="input-group mb-4">
        <label>📏 HAVING (условие для агрегатов)</label>
        <input
          type="text"
          value={having}
          onChange={(e) => {
            setHaving(e.target.value);
            updateParent();
          }}
          placeholder="например COUNT(id) > 5"
          className="bg-zinc-950 border border-zinc-800 rounded-lg px-3 py-2"
        />
      </div>

      {/* AGGREGATES */}
      <div className="input-group mb-4">
        <label>📈 Агрегаты (COUNT, SUM, AVG...)</label>
        {aggregates.map((a, i) => (
          <div key={i} className="flex gap-2 mb-1 flex-wrap">
            <select
              value={a.function}
              onChange={(e) => {
                const updated = [...aggregates];
                updated[i].function = e.target.value;
                setAggregates(updated);
                updateParent();
              }}
              className="bg-zinc-950 border border-zinc-800 rounded-lg px-2 py-2"
            >
              {["COUNT", "SUM", "AVG", "MAX", "MIN"].map((fn) => (
                <option key={fn}>{fn}</option>
              ))}
            </select>

            <select
              value={a.field}
              onChange={(e) => {
                const updated = [...aggregates];
                updated[i].field = e.target.value;
                setAggregates(updated);
                updateParent();
              }}
              className="bg-zinc-950 border border-zinc-800 rounded-lg px-3 py-2 w-full"
            >
              <option value="">— поле —</option>
              {schema?.[selectedTable]?.map((col: string) => (
                <option key={col}>{col}</option>
              ))}
            </select>

            <input
              placeholder="алиас (опц.)"
              value={a.alias}
              onChange={(e) => {
                const updated = [...aggregates];
                updated[i].alias = e.target.value;
                setAggregates(updated);
                updateParent();
              }}
              className="bg-zinc-950 border border-zinc-800 rounded-lg px-2 py-2 w-full"
            />
            <button
              className="delete-field-btn"
              onClick={() => {
                const updated = aggregates.filter((_, idx) => idx !== i);
                setAggregates(updated);
                updateParent();
              }}
            >
              ✖
            </button>
          </div>
        ))}
        <Button
          onClick={() => {
            setAggregates([...aggregates, { function: "COUNT", field: "", alias: "" }]);
            updateParent();
          }}
          className="add-btn text-sm px-3 py-1.5"
        >
          ➕ Добавить агрегат
        </Button>
      </div>

      {/* CASE WHEN */}
      <div className="input-group mb-4">
        <label>🧮 CASE WHEN</label>
        {caseWhenList.map((c, i) => (
          <div key={i} className="flex gap-2 mb-1 flex-wrap">
            <input
              placeholder="WHEN (условие)"
              value={c.condition}
              onChange={(e) => {
                const updated = [...caseWhenList];
                updated[i].condition = e.target.value;
                setCaseWhenList(updated);
                updateParent();
              }}
              className="bg-zinc-950 border border-zinc-800 rounded-lg px-2 py-2 w-full"
            />
            <input
              placeholder="THEN (результат)"
              value={c.result}
              onChange={(e) => {
                const updated = [...caseWhenList];
                updated[i].result = e.target.value;
                setCaseWhenList(updated);
                updateParent();
              }}
              className="bg-zinc-950 border border-zinc-800 rounded-lg px-2 py-2 w-full"
            />
            <button
              className="delete-field-btn"
              onClick={() => {
                const updated = caseWhenList.filter((_, idx) => idx !== i);
                setCaseWhenList(updated);
                updateParent();
              }}
            >
              ✖
            </button>
          </div>
        ))}
        <Button
          onClick={() => {
            setCaseWhenList([...caseWhenList, { condition: "", result: "" }]);
            updateParent();
          }}
          className="add-btn text-sm px-3 py-1.5"
        >
          ➕ Добавить CASE WHEN
        </Button>
      </div>

      {/* CTE */}
      <div className="input-group mb-4">
        <label>🧱 CTE (WITH)</label>
        {ctes.map((c, i) => (
          <div key={i} className="flex flex-col gap-2 mb-2">
            <input
              placeholder="Имя CTE"
              value={c.name}
              onChange={(e) => {
                const updated = [...ctes];
                updated[i].name = e.target.value;
                setCtes(updated);
                updateParent();
              }}
              className="bg-zinc-950 border border-zinc-800 rounded-lg px-2 py-2"
            />
            <textarea
              placeholder="SELECT ... FROM ..."
              value={c.query}
              onChange={(e) => {
                const updated = [...ctes];
                updated[i].query = e.target.value;
                setCtes(updated);
                updateParent();
              }}
              className="bg-zinc-950 border border-zinc-800 rounded-lg px-2 py-2 min-h-[60px]"
            />
            <button
              className="delete-field-btn self-end"
              onClick={() => {
                const updated = ctes.filter((_, idx) => idx !== i);
                setCtes(updated);
                updateParent();
              }}
            >
              ✖
            </button>
          </div>
        ))}
        <Button
          onClick={() => {
            setCtes([...ctes, { name: "", query: "" }]);
            updateParent();
          }}
          className="add-btn text-sm px-3 py-1.5"
        >
          ➕ Добавить CTE
        </Button>
      </div>

      {/* UNION */}
      <div className="input-group mb-4">
        <label>🔗 UNION / UNION ALL</label>
        {unions.map((u, i) => (
          <div key={i} className="flex flex-col gap-2 mb-2">
            <select
              value={u.type}
              onChange={(e) => {
                const updated = [...unions];
                updated[i].type = e.target.value as "UNION" | "UNION ALL";
                setUnions(updated);
                updateParent();
              }}
              className="bg-zinc-950 border border-zinc-800 rounded-lg px-3 py-2 w-40"
            >
              <option>UNION</option>
              <option>UNION ALL</option>
            </select>
            <textarea
              placeholder="SELECT ... FROM ..."
              value={u.query}
              onChange={(e) => {
                const updated = [...unions];
                updated[i].query = e.target.value;
                setUnions(updated);
                updateParent();
              }}
              className="bg-zinc-950 border border-zinc-800 rounded-lg px-2 py-2 min-h-[60px]"
            />
            <button
              className="delete-field-btn self-end"
              onClick={() => {
                const updated = unions.filter((_, idx) => idx !== i);
                setUnions(updated);
                updateParent();
              }}
            >
              ✖
            </button>
          </div>
        ))}
        <Button
          onClick={() => {
            setUnions([...unions, { type: "UNION", query: "" }]);
            updateParent();
          }}
          className="add-btn text-sm px-3 py-1.5"
        >
          ➕ Добавить UNION
        </Button>
      </div>

      {/* EXPRESSIONS */}
      <div className="input-group mb-5">
        <label>🧠 Пользовательские выражения</label>
        {expressions.map((ex, i) => (
          <div key={i} className="flex gap-2 mb-1">
            <input
              placeholder="price * quantity, total / count(id)..."
              value={ex}
              onChange={(e) => {
                const updated = [...expressions];
                updated[i] = e.target.value;
                setExpressions(updated);
                updateParent();
              }}
              className="bg-zinc-950 border border-zinc-800 rounded-lg px-2 py-2 w-full"
            />
            <button
              className="delete-field-btn"
              onClick={() => {
                const updated = expressions.filter((_, idx) => idx !== i);
                setExpressions(updated);
                updateParent();
              }}
            >
              ✖
            </button>
          </div>
        ))}
        <Button
          onClick={() => {
            setExpressions([...expressions, ""]);
            updateParent();
          }}
          className="add-btn text-sm px-3 py-1.5"
        >
          ➕ Добавить выражение
        </Button>
      </div>

      {/* SHOW SQL */}
      <div className="flex justify-end border-t border-zinc-800 pt-3">
        <Button
          onClick={() => setShowSql(!showSql)}
          variant="ghost"
          className="add-btn show-sql !bg-gradient-to-r !from-[#0077b6] !to-[#00b4d8] text-white font-medium shadow-md hover:shadow-lg hover:brightness-110 transition-all"
        >
          {showSql ? "Скрыть SQL" : "Показать SQL"}
        </Button>
      </div>

      {showSql && (
        <div className="sql-output bg-zinc-950 border border-zinc-800 rounded-xl p-3 mt-3 text-xs text-gray-300 font-mono overflow-x-auto">
          Здесь появится SQL для Advanced уровня.
        </div>
      )}
    </PanelWrapper>
  );
}
