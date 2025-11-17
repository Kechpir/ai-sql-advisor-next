import React from "react";

interface Props {
  groupBy: string[];
  orderBy: { field: string; direction: string }[];
  onChange: (
    groupBy: string[],
    orderBy: { field: string; direction: string }[]
  ) => void;
  availableFields?: string[];
}

export default function GroupOrderSection({
  groupBy,
  orderBy,
  onChange,
  availableFields = [],
}: Props) {
  const addGroup = () => onChange([...groupBy, ""], orderBy);
  const addOrder = () =>
    onChange(groupBy, [...orderBy, { field: "", direction: "ASC" }]);

  const updateGroup = (i: number, value: string) => {
    const updated = [...groupBy];
    updated[i] = value;
    onChange(updated, orderBy);
  };

  const updateOrder = (
    i: number,
    key: keyof (typeof orderBy)[0],
    value: string
  ) => {
    const updated = [...orderBy];
    updated[i][key] = value;
    onChange(groupBy, updated);
  };

  const removeGroup = (i: number) =>
    onChange(groupBy.filter((_, idx) => idx !== i), orderBy);
  const removeOrder = (i: number) =>
    onChange(groupBy, orderBy.filter((_, idx) => idx !== i));

  return (
    <div className="mt-4">
      {/* GROUP BY */}
      <label className="flex items-center gap-2 mb-2 text-gray-300 text-sm font-medium">

        📚 GROUP BY
      </label>

      <div className="space-y-2">
        {groupBy.map((g, i) => (
          <div
            key={i}
            className="flex flex-wrap gap-2 items-center bg-[#0f172a] border border-[#1e293b] p-2 rounded-lg"
          >
            <select
              value={g}
              onChange={(e) => updateGroup(i, e.target.value)}
              className="sql-input w-60"
            >
              <option value="">— выбрать поле —</option>
              {availableFields.map((f) => (
                <option key={f}>{f}</option>
              ))}
            </select>

            <button
              onClick={() => removeGroup(i)}
              className="btn btn-danger btn-sm px-2 py-1 text-sm"
              title="Удалить группу"
            >
              ✖
            </button>
          </div>
        ))}

        <button onClick={addGroup} className="btn btn-secondary btn-sm mt-2">
          ➕ Добавить Group
        </button>
      </div>

      {/* ORDER BY */}
      <label className="flex items-center gap-2 mb-2 text-gray-300 text-sm font-medium">

        📊 ORDER BY
      </label>

      <div className="space-y-2">
        {orderBy.map((o, i) => (
          <div
            key={i}
            className="flex flex-wrap gap-2 items-center bg-[#0f172a] border border-[#1e293b] p-2 rounded-lg"
          >
            <select
              value={o.field}
              onChange={(e) => updateOrder(i, "field", e.target.value)}
              className="sql-input w-60"
            >
              <option value="">— выбрать поле —</option>
              {availableFields.map((f) => (
                <option key={f}>{f}</option>
              ))}
            </select>

            <select
              value={o.direction}
              onChange={(e) => updateOrder(i, "direction", e.target.value)}
              className="sql-input w-28"
            >
              <option>ASC</option>
              <option>DESC</option>
            </select>

            <button
              onClick={() => removeOrder(i)}
              className="btn btn-danger btn-sm px-2 py-1 text-sm"
              title="Удалить сортировку"
            >
              ✖
            </button>
          </div>
        ))}

        <button onClick={addOrder} className="btn btn-secondary btn-sm mt-2">
          ➕ Добавить Order
        </button>
      </div>
    </div>
  );
}
