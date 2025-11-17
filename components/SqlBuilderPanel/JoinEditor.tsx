import React from "react";

interface Join {
  type: string;
  table: string;
  field1: string;
  field2: string;
}

interface Props {
  joins: Join[];
  onChange: (joins: Join[]) => void;
  schema: Record<string, string[]>;
  selectedTable: string;
}

export default function JoinEditor({ joins, onChange, schema, selectedTable }: Props) {
  const addJoin = () => onChange([...joins, { type: "INNER", table: "", field1: "", field2: "" }]);
  const removeJoin = (i: number) => onChange(joins.filter((_, idx) => idx !== i));

  const update = (i: number, key: keyof Join, value: string) => {
    const updated = [...joins];
    updated[i][key] = value;
    onChange(updated);
  };

  return (
    <div className="panel-section">
      <h3 className="section-title">🔗 JOIN связи между таблицами</h3>

      {joins.map((j, i) => (
        <div key={i} className="flex gap-2 items-center mb-2">
          {/* Тип соединения */}
          <select
            value={j.type}
            onChange={(e) => update(i, "type", e.target.value)}
            className="sql-input w-[120px]"
          >
            {["INNER", "LEFT", "RIGHT", "FULL"].map((type) => (
              <option key={type}>{type}</option>
            ))}
          </select>

          {/* Таблица для соединения */}
          <select
            value={j.table}
            onChange={(e) => update(i, "table", e.target.value)}
            className="sql-input w-[160px]"
          >
            <option value="">— таблица —</option>
            {Object.keys(schema).map((t) => (
              <option key={t}>{t}</option>
            ))}
          </select>

          {/* Поле из текущей таблицы */}
          <select
            value={j.field1}
            onChange={(e) => update(i, "field1", e.target.value)}
            className="sql-input w-[150px]"
          >
            <option value="">— поле (из {selectedTable}) —</option>
            {schema[selectedTable]?.map((col) => (
              <option key={col}>{col}</option>
            ))}
          </select>

          <span style={{ color: "#94a3b8" }}>=</span>

          {/* Поле из выбранной таблицы */}
          <select
            value={j.field2}
            onChange={(e) => update(i, "field2", e.target.value)}
            className="sql-input w-[150px]"
          >
            <option value="">— поле (из {j.table || "?"}) —</option>
            {schema[j.table]?.map((col) => (
              <option key={col}>{col}</option>
            ))}
          </select>

          <button
            onClick={() => removeJoin(i)}
            className="btn btn-danger"
            title="Удалить JOIN"
          >
            ✖
          </button>
        </div>
      ))}

      <button onClick={addJoin} className="btn btn-ghost mt-2">
        ➕ Добавить JOIN
      </button>
    </div>
  );
}
