import React from "react";

interface FilterEditorProps {
  filters: { field: string; op: string; value: string }[];
  setFilters: (filters: { field: string; op: string; value: string }[]) => void;
}

export default function FilterEditor({ filters, setFilters }: FilterEditorProps) {
  const handleAddFilter = () =>
    setFilters([...filters, { field: "", op: "=", value: "" }]);

  return (
    <div className="filters-section">
      <label>Фильтры (WHERE):</label>
      {filters.map((f, i) => (
        <div key={i} className="filter-row">
          <input
            type="text"
            placeholder="Поле"
            value={f.field}
            onChange={(e) => {
              const updated = [...filters];
              updated[i].field = e.target.value;
              setFilters(updated);
            }}
          />
          <select
            value={f.op}
            onChange={(e) => {
              const updated = [...filters];
              updated[i].op = e.target.value;
              setFilters(updated);
            }}
          >
            <option>=</option>
            <option>!=</option>
            <option>&gt;</option>
            <option>&lt;</option>
            <option>&gt;=</option>
            <option>&lt;=</option>
            <option>LIKE</option>
          </select>
          <input
            type="text"
            placeholder="Значение"
            value={f.value}
            onChange={(e) => {
              const updated = [...filters];
              updated[i].value = e.target.value;
              setFilters(updated);
            }}
          />
        </div>
      ))}

      <button className="btn-add-filter" onClick={handleAddFilter}>
        ➕ Добавить фильтр
      </button>
    </div>
  );
}
