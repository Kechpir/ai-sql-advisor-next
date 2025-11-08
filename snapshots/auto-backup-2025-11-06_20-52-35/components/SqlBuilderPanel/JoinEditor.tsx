import React from "react";

interface JoinEditorProps {
  joins: { type: "INNER" | "LEFT" | "RIGHT" | "FULL"; table: string; on: string }[];
  setJoins: (
    joins: { type: "INNER" | "LEFT" | "RIGHT" | "FULL"; table: string; on: string }[]
  ) => void;
}

export default function JoinEditor({ joins, setJoins }: JoinEditorProps) {
  const handleAddJoin = () =>
    setJoins([...joins, { type: "INNER", table: "", on: "" }]);

  return (
    <div className="join-section">
      <label>Объединения (JOIN):</label>
      {joins.map((j, i) => (
        <div key={i} className="join-row">
          <select
            value={j.type}
            onChange={(e) => {
              const updated = [...joins];
              updated[i].type = e.target.value as "INNER" | "LEFT" | "RIGHT" | "FULL";
              setJoins(updated);
            }}
          >
            <option value="INNER">INNER</option>
            <option value="LEFT">LEFT</option>
            <option value="RIGHT">RIGHT</option>
            <option value="FULL">FULL</option>
          </select>

          <input
            type="text"
            placeholder="Имя таблицы"
            value={j.table}
            onChange={(e) => {
              const updated = [...joins];
              updated[i].table = e.target.value;
              setJoins(updated);
            }}
          />

          <input
            type="text"
            placeholder="ON (пример: users.id = orders.user_id)"
            value={j.on}
            onChange={(e) => {
              const updated = [...joins];
              updated[i].on = e.target.value;
              setJoins(updated);
            }}
          />
        </div>
      ))}

      <button className="btn-add-join" onClick={handleAddJoin}>
        ➕ Добавить JOIN
      </button>
    </div>
  );
}
