import React, { useState } from "react";

interface AggregateField {
  func: string;
  field: string;
  alias: string;
}

interface Props {
  schema: Record<string, string[]>;
  selectedTable: string;
  onChange: (data: any) => void;
}

export default function AdvancedSqlPanel({ schema, selectedTable, onChange }: Props) {
  const [aggregates, setAggregates] = useState<AggregateField[]>([]);
  const [having, setHaving] = useState("");

  const addAggregate = () => {
    setAggregates([...aggregates, { func: "COUNT", field: "", alias: "" }]);
  };

  const updateAggregate = (index: number, key: keyof AggregateField, value: string) => {
    const updated = [...aggregates];
    updated[index][key] = value;
    setAggregates(updated);
    onChange({ aggregates: updated, having });
  };

  const removeAggregate = (index: number) => {
    const updated = aggregates.filter((_, i) => i !== index);
    setAggregates(updated);
    onChange({ aggregates: updated, having });
  };

  const handleHavingChange = (val: string) => {
    setHaving(val);
    onChange({ aggregates, having: val });
  };

  return (
    <div className="advanced-panel">
      {/* Агрегации */}
      <div className="mb-3">
        <label className="block text-sm text-gray-300 mb-2">📊 Агрегации</label>
        {aggregates.map((agg, i) => (
          <div key={i} className="flex flex-wrap gap-2 mb-2 items-center">
            <select
              value={agg.func}
              onChange={(e) => updateAggregate(i, "func", e.target.value)}
              className="sql-input w-36"
            >
              {["COUNT", "SUM", "AVG", "MIN", "MAX"].map((f) => (
                <option key={f}>{f}</option>
              ))}
            </select>

            <select
              value={agg.field}
              onChange={(e) => updateAggregate(i, "field", e.target.value)}
              className="sql-input w-48"
            >
              <option value="">— выбрать поле —</option>
              {schema?.[selectedTable]?.map((col) => (
                <option key={col}>{col}</option>
              ))}
            </select>

            <input
              type="text"
              placeholder="алиас (например, total_sum)"
              value={agg.alias}
              onChange={(e) => updateAggregate(i, "alias", e.target.value)}
              className="sql-input flex-1"
            />

            <button className="btn btn-danger" onClick={() => removeAggregate(i)}>
              ✖
            </button>
          </div>
        ))}

        <button className="btn btn-ghost text-sm" onClick={addAggregate}>
          ➕ Добавить агрегат
        </button>
      </div>

      {/* HAVING */}
      <div className="mt-4">
        <label className="block text-sm text-gray-300 mb-2">⚙️ HAVING условие</label>
        <input
          type="text"
          placeholder="Например: COUNT(id) > 10"
          value={having}
          onChange={(e) => handleHavingChange(e.target.value)}
          className="sql-input w-full"
        />
      </div>
    </div>
  );
}
