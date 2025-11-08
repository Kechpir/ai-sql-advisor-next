import React, { useState } from "react";
import { Button } from "../ui/button";

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

export default function AdvancedSqlPanel({ schema, selectedTable, onChange }: any) {
  const [distinct, setDistinct] = useState(false);
  const [groupBy, setGroupBy] = useState<string[]>([]);
  const [having, setHaving] = useState<string>("");
  const [aggregates, setAggregates] = useState<AggregateField[]>([]);
  const [caseWhenList, setCaseWhenList] = useState<CaseWhen[]>([]);
  const [ctes, setCtes] = useState<Cte[]>([]);
  const [unions, setUnions] = useState<UnionQuery[]>([]);
  const [expressions, setExpressions] = useState<string[]>([]);

  // Обновление родителя
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
    <div className="sql-builder-panel mt-8">
      <h2 className="panel-title text-cyan-400">🧩 Расширенные SQL-компоненты</h2>

      {/* DISTINCT */}
      <div className="input-group flex items-center gap-3">
        <label>🔹 DISTINCT:</label>
        <input
          type="checkbox"
          checked={distinct}
          onChange={(e) => {
            setDistinct(e.target.checked);
            updateParent();
          }}
        />
      </div>

      {/* GROUP BY */}
      <div className="input-group">
        <label>📊 GROUP BY:</label>
        {groupBy.map((g, i) => (
          <div key={i} className="field-row">
            <select
              value={g}
              onChange={(e) => {
                const updated = [...groupBy];
                updated[i] = e.target.value;
                setGroupBy(updated);
                updateParent();
              }}
            >
              <option value="">— выберите поле —</option>
              {schema?.[selectedTable]?.map((col: string) => (
                <option key={col} value={col}>
                  {col}
                </option>
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
        >
          ➕ Добавить GROUP
        </Button>
      </div>

      {/* HAVING */}
      <div className="input-group">
        <label>📏 HAVING (условие для агрегатов):</label>
        <input
          type="text"
          value={having}
          onChange={(e) => {
            setHaving(e.target.value);
            updateParent();
          }}
          placeholder="например COUNT(id) > 5"
        />
      </div>

      {/* AGGREGATES */}
      <div className="input-group">
        <label>📈 Агрегаты (COUNT, SUM, AVG...):</label>
        {aggregates.map((a, i) => (
          <div key={i} className="field-row">
            <select
              value={a.function}
              onChange={(e) => {
                const updated = [...aggregates];
                updated[i].function = e.target.value;
                setAggregates(updated);
                updateParent();
              }}
            >
              <option value="COUNT">COUNT</option>
              <option value="SUM">SUM</option>
              <option value="AVG">AVG</option>
              <option value="MAX">MAX</option>
              <option value="MIN">MIN</option>
            </select>

            <select
              value={a.field}
              onChange={(e) => {
                const updated = [...aggregates];
                updated[i].field = e.target.value;
                setAggregates(updated);
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
              placeholder="алиас (опционально)"
              value={a.alias}
              onChange={(e) => {
                const updated = [...aggregates];
                updated[i].alias = e.target.value;
                setAggregates(updated);
                updateParent();
              }}
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
        >
          ➕ Добавить агрегат
        </Button>
      </div>

      {/* CASE WHEN */}
      <div className="input-group">
        <label>🧮 CASE WHEN:</label>
        {caseWhenList.map((c, i) => (
          <div key={i} className="field-row">
            <input
              placeholder="WHEN (условие)"
              value={c.condition}
              onChange={(e) => {
                const updated = [...caseWhenList];
                updated[i].condition = e.target.value;
                setCaseWhenList(updated);
                updateParent();
              }}
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
        >
          ➕ Добавить CASE WHEN
        </Button>
      </div>

      {/* CTE */}
      <div className="input-group">
        <label>🧱 CTE (WITH):</label>
        {ctes.map((c, i) => (
          <div key={i} className="field-row">
            <input
              placeholder="Имя CTE"
              value={c.name}
              onChange={(e) => {
                const updated = [...ctes];
                updated[i].name = e.target.value;
                setCtes(updated);
                updateParent();
              }}
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
              style={{ width: "100%", minHeight: "60px" }}
            />
            <button
              className="delete-field-btn"
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
        >
          ➕ Добавить CTE
        </Button>
      </div>

      {/* UNION */}
      <div className="input-group">
        <label>🔗 UNION / UNION ALL:</label>
        {unions.map((u, i) => (
          <div key={i} className="field-row">
            <select
              value={u.type}
              onChange={(e) => {
                const updated = [...unions];
                updated[i].type = e.target.value as "UNION" | "UNION ALL";
                setUnions(updated);
                updateParent();
              }}
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
              style={{ width: "100%", minHeight: "60px" }}
            />
            <button
              className="delete-field-btn"
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
        >
          ➕ Добавить UNION
        </Button>
      </div>

      {/* EXPRESSIONS */}
      <div className="input-group">
        <label>🧠 Пользовательские выражения:</label>
        {expressions.map((ex, i) => (
          <div key={i} className="field-row">
            <input
              placeholder="price * quantity, total / count(id) и т.п."
              value={ex}
              onChange={(e) => {
                const updated = [...expressions];
                updated[i] = e.target.value;
                setExpressions(updated);
                updateParent();
              }}
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
        >
          ➕ Добавить выражение
        </Button>
      </div>
    </div>
  );
}
