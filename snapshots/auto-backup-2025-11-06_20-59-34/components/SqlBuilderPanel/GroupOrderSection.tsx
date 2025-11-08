import React from "react";

interface GroupOrderSectionProps {
  groupBy: string[];
  setGroupBy: (fields: string[]) => void;
  orderBy: { field: string; direction: "ASC" | "DESC" }[];
  setOrderBy: (
    orders: { field: string; direction: "ASC" | "DESC" }[]
  ) => void;
}

export default function GroupOrderSection({
  groupBy,
  setGroupBy,
  orderBy,
  setOrderBy,
}: GroupOrderSectionProps) {
  const handleAddOrder = () =>
    setOrderBy([...orderBy, { field: "", direction: "ASC" }]);

  return (
    <div className="group-order-section">
      <div className="input-group">
        <label>GROUP BY:</label>
        <input
          type="text"
          placeholder="Например: name, country"
          value={groupBy.join(", ")}
          onChange={(e) =>
            setGroupBy(e.target.value.split(",").map((v) => v.trim()))
          }
        />
      </div>

      <div className="input-group">
        <label>ORDER BY:</label>
        {orderBy.map((o, i) => (
          <div key={i} className="order-row">
            <input
              type="text"
              placeholder="Поле"
              value={o.field}
              onChange={(e) => {
                const updated = [...orderBy];
                updated[i].field = e.target.value;
                setOrderBy(updated);
              }}
            />
            <select
              value={o.direction}
              onChange={(e) => {
                const updated = [...orderBy];
                updated[i].direction = e.target.value as "ASC" | "DESC";
                setOrderBy(updated);
              }}
            >
              <option value="ASC">ASC</option>
              <option value="DESC">DESC</option>
            </select>
          </div>
        ))}

        <button className="btn-add-order" onClick={handleAddOrder}>
          ➕ Добавить сортировку
        </button>
      </div>
    </div>
  );
}
