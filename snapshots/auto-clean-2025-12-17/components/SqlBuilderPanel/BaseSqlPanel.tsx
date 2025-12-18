import React, { useState, useEffect } from "react";

interface Props {
  schema: any;
  onChange: (queryData: any) => void;
}

export default function BaseSqlPanel({ schema, onChange }: Props) {
  const [table, setTable] = useState("");
  const [fields, setFields] = useState<string[]>([]);
  const [filters, setFilters] = useState<{ field: string; op: string; value: string }[]>([]);
  const [orderBy, setOrderBy] = useState<{ field: string; direction: string }[]>([]);
  const [limit, setLimit] = useState("");
  const [offset, setOffset] = useState("");

  // 🔄 Обновляем JSON-запрос при каждом изменении
  useEffect(() => {
    onChange({ table, fields, filters, orderBy, limit, offset });
  }, [table, fields, filters, orderBy, limit, offset]);

  const addFilter = () => setFilters([...filters, { field: "", op: "=", value: "" }]);
  const removeFilter = (i: number) => setFilters(filters.filter((_, idx) => idx !== i));
  const addOrder = () => setOrderBy([...orderBy, { field: "", direction: "ASC" }]);
  const removeOrder = (i: number) => setOrderBy(orderBy.filter((_, idx) => idx !== i));

  const getColumns = () => (table && schema?.[table]) || [];

  return (
    <div className="main-card">
      <h3 style={{ color: "#22d3ee" }}>⚙️ Основные SQL операции</h3>

      <label>Таблица</label>
      <select value={table} onChange={(e) => setTable(e.target.value)}>
        <option value="">— выберите таблицу —</option>
        {Object.keys(schema || {}).map((t) => (
          <option key={t}>{t}</option>
        ))}
      </select>

      <label>Поля SELECT</label>
      <div>
        {fields.map((f, i) => (
          <div key={i} style={{ display: "flex", gap: "0.5rem", marginBottom: "0.5rem" }}>
            <select
              value={f}
              onChange={(e) => {
                const updated = [...fields];
                updated[i] = e.target.value;
                setFields(updated);
              }}
            >
              <option value="">— поле —</option>
              {getColumns().map((col: string) => (
                <option key={col}>{col}</option>
              ))}
            </select>
            <button className="btn btn-sec" onClick={() => removeFilter(i)}>
              ❌
            </button>
          </div>
        ))}
        <button className="btn btn-main" onClick={() => setFields([...fields, ""])}>
          ➕ Добавить поле
        </button>
      </div>

      <h4 style={{ marginTop: "1rem" }}>🔍 WHERE</h4>
      {filters.map((f, i) => (
        <div key={i} style={{ display: "flex", gap: "0.5rem", marginBottom: "0.5rem" }}>
          <select
            value={f.field}
            onChange={(e) => {
              const updated = [...filters];
              updated[i].field = e.target.value;
              setFilters(updated);
            }}
          >
            <option value="">— поле —</option>
            {getColumns().map((col: string) => (
              <option key={col}>{col}</option>
            ))}
          </select>
          <select
            value={f.op}
            onChange={(e) => {
              const updated = [...filters];
              updated[i].op = e.target.value;
              setFilters(updated);
            }}
          >
            {["=", "!=", ">", "<", ">=", "<=", "LIKE", "IS NULL", "IS NOT NULL"].map((op) => (
              <option key={op}>{op}</option>
            ))}
          </select>
          <input
            value={f.value}
            onChange={(e) => {
              const updated = [...filters];
              updated[i].value = e.target.value;
              setFilters(updated);
            }}
            placeholder="значение"
          />
          <button className="btn btn-sec" onClick={() => removeFilter(i)}>
            ❌
          </button>
        </div>
      ))}
      <button className="btn btn-main" onClick={addFilter}>
        ➕ Добавить условие
      </button>

      <h4 style={{ marginTop: "1rem" }}>↕ ORDER BY</h4>
      {orderBy.map((o, i) => (
        <div key={i} style={{ display: "flex", gap: "0.5rem", marginBottom: "0.5rem" }}>
          <select
            value={o.field}
            onChange={(e) => {
              const updated = [...orderBy];
              updated[i].field = e.target.value;
              setOrderBy(updated);
            }}
          >
            <option value="">— поле —</option>
            {getColumns().map((col: string) => (
              <option key={col}>{col}</option>
            ))}
          </select>
          <select
            value={o.direction}
            onChange={(e) => {
              const updated = [...orderBy];
              updated[i].direction = e.target.value;
              setOrderBy(updated);
            }}
          >
            <option value="ASC">ASC</option>
            <option value="DESC">DESC</option>
          </select>
          <button className="btn btn-sec" onClick={() => removeOrder(i)}>
            ❌
          </button>
        </div>
      ))}
      <button className="btn btn-main" onClick={addOrder}>
        ➕ Добавить сортировку
      </button>

      <div style={{ display: "flex", gap: "1rem", marginTop: "1rem" }}>
        <div style={{ flex: 1 }}>
          <label>LIMIT</label>
          <input value={limit} onChange={(e) => setLimit(e.target.value)} />
        </div>
        <div style={{ flex: 1 }}>
          <label>OFFSET</label>
          <input value={offset} onChange={(e) => setOffset(e.target.value)} />
        </div>
      </div>
    </div>
  );
}
