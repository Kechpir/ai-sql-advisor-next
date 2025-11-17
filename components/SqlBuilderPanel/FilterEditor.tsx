import React from "react";

interface Filter {
  field: string;
  operator: string;
  value: string;
}

interface Props {
  filters: Filter[];
  onChange: (filters: Filter[]) => void;
  availableFields?: string[];
}

export default function FilterEditor({
  filters,
  onChange,
  availableFields = [],
}: Props) {
  const update = (index: number, key: keyof Filter, value: string) => {
    const updated = [...filters];
    updated[index][key] = value;
    onChange(updated);
  };

  const addFilter = () =>
    onChange([...filters, { field: "", operator: "=", value: "" }]);

  const removeFilter = (index: number) =>
    onChange(filters.filter((_, i) => i !== index));

  return (
    <div className="mt-3">
      <label className="flex items-center gap-2 mb-2 text-gray-300 text-sm font-medium">

        🔍 WHERE условия
      </label>

      <div className="space-y-2">
        {filters.map((filter, i) => (
          <div
            key={i}
            className="flex flex-wrap gap-2 items-center bg-[#0f172a] border border-[#1e293b] p-2 rounded-lg"
          >
            <select
              value={filter.field}
              onChange={(e) => update(i, "field", e.target.value)}
              className="sql-input w-40"
            >
              <option value="">— поле —</option>
              {availableFields.map((col) => (
                <option key={col}>{col}</option>
              ))}
            </select>

            <select
              value={filter.operator}
              onChange={(e) => update(i, "operator", e.target.value)}
              className="sql-input w-28"
            >
              {[
                "=",
                "!=",
                ">",
                "<",
                ">=",
                "<=",
                "LIKE",
                "IN",
                "NOT IN",
                "IS NULL",
                "IS NOT NULL",
              ].map((op) => (
                <option key={op}>{op}</option>
              ))}
            </select>

            <input
              value={filter.value}
              onChange={(e) => update(i, "value", e.target.value)}
              placeholder="значение"
              className="sql-input flex-1"
            />

            <button
              onClick={() => removeFilter(i)}
              className="btn btn-danger btn-sm px-2 py-1 text-sm"
              title="Удалить фильтр"
            >
              ✖
            </button>
          </div>
        ))}

        <button
          onClick={addFilter}
          className="btn btn-secondary btn-sm mt-3"
        >
          ➕ Добавить фильтр
        </button>
      </div>
    </div>
  );
}
