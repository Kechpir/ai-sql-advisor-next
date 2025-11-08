import React from "react";

interface FieldsSelectorProps {
  fields: string[];
  setFields: (fields: string[]) => void;
  aggregateFunctions: Record<string, string>;
  setAggregateFunctions: (funcs: Record<string, string>) => void;
}

export default function FieldsSelector({
  fields,
  setFields,
  aggregateFunctions,
  setAggregateFunctions,
}: FieldsSelectorProps) {
  return (
    <div className="input-group fields-selector">
      <label>Поля SELECT / Aggregate:</label>

      {fields.map((field, i) => (
        <div key={i} className="field-agg-row">
          <input
            type="text"
            value={field}
            placeholder="Поле (например: amount)"
            onChange={(e) => {
              const updated = [...fields];
              updated[i] = e.target.value;
              setFields(updated);
            }}
          />

          <select
            value={aggregateFunctions[field] || ""}
            onChange={(e) =>
              setAggregateFunctions({
                ...aggregateFunctions,
                [field]: e.target.value,
              })
            }
          >
            <option value="">—</option>
            <option value="SUM">SUM</option>
            <option value="AVG">AVG</option>
            <option value="COUNT">COUNT</option>
            <option value="MIN">MIN</option>
            <option value="MAX">MAX</option>
          </select>
        </div>
      ))}

      <button
        className="btn-add-field"
        onClick={() => setFields([...fields, ""])}
      >
        ➕ Добавить поле
      </button>
    </div>
  );
}
