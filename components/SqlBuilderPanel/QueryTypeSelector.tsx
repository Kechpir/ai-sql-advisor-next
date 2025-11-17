import React from "react";

interface Props {
  value: string;
  onChange: (val: string) => void;
}

export default function QueryTypeSelector({ value, onChange }: Props) {
  const types = ["SELECT", "INSERT", "UPDATE", "DELETE"];

  return (
    <div className="mt-3">
      <label className="block mb-1 text-gray-300 text-sm">⚙️ Тип SQL-запроса</label>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="sql-input w-full"
      >
        {types.map((type) => (
          <option key={type}>{type}</option>
        ))}
      </select>
    </div>
  );
}
