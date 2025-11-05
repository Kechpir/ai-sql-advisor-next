import React, { useState, useEffect } from "react";

interface Schema {
  [table: string]: { column: string; type: string }[];
}

export default function SqlBuilderPanel({ onExecute }: { onExecute: (query: any) => void }) {
  const [schema, setSchema] = useState<Schema>({});
  const [tables, setTables] = useState<string[]>([]);
  const [fields, setFields] = useState<string[]>([]);
  const [selectedTable, setSelectedTable] = useState("");
  const [selectedFields, setSelectedFields] = useState<string[]>([]);
  const [queryType, setQueryType] = useState("SELECT");

  // WHERE / ORDER BY / JOIN / GROUP BY
  const [whereClauses, setWhereClauses] = useState<any[]>([]);
  const [orderClauses, setOrderClauses] = useState<any[]>([]);
  const [joinClauses, setJoinClauses] = useState<any[]>([]);
  const [groupFields, setGroupFields] = useState<string[]>([]);
  const [limit, setLimit] = useState<number | null>(null);

  // Aggregates
  const [useAggregate, setUseAggregate] = useState(false);
  const aggregateFunctions = ["COUNT", "SUM", "AVG", "MAX", "MIN"];

  // Автозагрузка схемы при старте
  useEffect(() => {
    fetchSchema();
  }, []);

  const fetchSchema = async () => {
    try {
      const res = await fetch("/api/fetch-schema");
      const data = await res.json();
      if (data.success && data.schema) {
        setSchema(data.schema);
        setTables(Object.keys(data.schema));
      }
    } catch (err) {
      console.error("Ошибка загрузки схемы:", err);
    }
  };

  const handleTableChange = (table: string) => {
    setSelectedTable(table);
    setFields(schema[table]?.map((c) => c.column) || []);
    setSelectedFields([]);
  };

  const handleAddWhere = () => setWhereClauses([...whereClauses, { field: "", op: "=", value: "" }]);
  const handleAddOrder = () => setOrderClauses([...orderClauses, { field: "", direction: "ASC" }]);
  const handleAddJoin = () => setJoinClauses([...joinClauses, { type: "INNER", table: "", on: "" }]);
  const handleAddGroup = () => setGroupFields([...groupFields, ""]);

  const removeWhere = (i: number) => setWhereClauses(whereClauses.filter((_, idx) => idx !== i));
  const removeOrder = (i: number) => setOrderClauses(orderClauses.filter((_, idx) => idx !== i));
  const removeJoin = (i: number) => setJoinClauses(joinClauses.filter((_, idx) => idx !== i));
  const removeGroup = (i: number) => setGroupFields(groupFields.filter((_, idx) => idx !== i));

  const handleExecute = () => {
    const query = {
      dbType: "postgres",
      queryType,
      table: selectedTable,
      fields: selectedFields,
      joins: joinClauses,
      filters: whereClauses,
      orderBy: orderClauses,
      groupBy: groupFields,
      limit,
      aggregate: useAggregate,
    };
    onExecute(query);
  };

  return (
    <div className="p-4 bg-black/30 rounded-2xl space-y-4 border border-gray-700 text-white">
      {/* 🔄 Обновить схему */}
      <div className="flex justify-between items-center">
        <h2 className="text-xl font-semibold">SQL Конструктор</h2>
        <button
          className="bg-blue-700 hover:bg-blue-800 text-white rounded px-3 py-1"
          onClick={fetchSchema}
        >
          🔁 Обновить схему
        </button>
      </div>

      {/* Тип SQL-запроса */}
      <div>
        <label>Тип SQL-запроса:</label>
        <select
          className="w-full bg-gray-900 text-white rounded p-2 mt-1"
          value={queryType}
          onChange={(e) => setQueryType(e.target.value)}
        >
          <option>SELECT</option>
          <option>INSERT</option>
          <option>UPDATE</option>
          <option>DELETE</option>
        </select>
      </div>

      {/* Таблица */}
      <div>
        <label>Таблица:</label>
        <select
          className="w-full bg-gray-900 text-white rounded p-2 mt-1"
          value={selectedTable}
          onChange={(e) => handleTableChange(e.target.value)}
        >
          <option value="">Выберите таблицу...</option>
          {tables.map((t) => (
            <option key={t}>{t}</option>
          ))}
        </select>
      </div>

      {/* Поля */}
      {queryType === "SELECT" && (
        <div>
          <label>Поля:</label>
          <select
            multiple
            className="w-full bg-gray-900 text-white rounded p-2 mt-1 h-24"
            value={selectedFields}
            onChange={(e) =>
              setSelectedFields(Array.from(e.target.selectedOptions, (opt) => opt.value))
            }
          >
            {fields.map((f) => (
              <option key={f}>{f}</option>
            ))}
          </select>

          <div className="flex items-center gap-2 mt-2">
            <input
              type="checkbox"
              checked={useAggregate}
              onChange={(e) => setUseAggregate(e.target.checked)}
            />
            <span>Использовать агрегатные функции</span>
          </div>

          {useAggregate && (
            <div className="mt-2 grid grid-cols-2 gap-2">
              {selectedFields.map((f) => (
                <select key={f} className="bg-gray-900 text-white rounded p-2">
                  <option value="">Без функции — {f}</option>
                  {aggregateFunctions.map((fn) => (
                    <option key={fn} value={fn}>{`${fn}(${f})`}</option>
                  ))}
                </select>
              ))}
            </div>
          )}
        </div>
      )}

      {/* JOIN */}
      <div className="space-y-2">
        <div className="flex justify-between items-center">
          <span>JOIN</span>
          <button
            className="bg-gray-700 hover:bg-gray-800 rounded px-2 py-1"
            onClick={handleAddJoin}
          >
            + Добавить JOIN
          </button>
        </div>
        {joinClauses.map((j, i) => (
          <div key={i} className="flex gap-2 items-center">
            <select
              value={j.type}
              onChange={(e) => {
                const v = [...joinClauses];
                v[i].type = e.target.value;
                setJoinClauses(v);
              }}
              className="bg-gray-900 text-white p-2 rounded"
            >
              <option>INNER</option>
              <option>LEFT</option>
              <option>RIGHT</option>
            </select>
            <input
              className="bg-gray-900 text-white p-2 rounded w-1/3"
              placeholder="Таблица"
              value={j.table}
              onChange={(e) => {
                const v = [...joinClauses];
                v[i].table = e.target.value;
                setJoinClauses(v);
              }}
            />
            <input
              className="bg-gray-900 text-white p-2 rounded flex-1"
              placeholder="Условие ON"
              value={j.on}
              onChange={(e) => {
                const v = [...joinClauses];
                v[i].on = e.target.value;
                setJoinClauses(v);
              }}
            />
            <button
              className="bg-red-700 hover:bg-red-800 text-white rounded px-2 py-1"
              onClick={() => removeJoin(i)}
            >
              ❌
            </button>
          </div>
        ))}
      </div>

      {/* WHERE */}
      <div className="space-y-2">
        <div className="flex justify-between items-center">
          <span>WHERE</span>
          <button
            className="bg-gray-700 hover:bg-gray-800 rounded px-2 py-1"
            onClick={handleAddWhere}
          >
            + Добавить фильтр
          </button>
        </div>
        {whereClauses.map((w, i) => (
          <div key={i} className="flex gap-2 items-center">
            <select
              value={w.field}
              onChange={(e) => {
                const v = [...whereClauses];
                v[i].field = e.target.value;
                setWhereClauses(v);
              }}
              className="bg-gray-900 text-white p-2 rounded w-1/3"
            >
              <option value="">Поле</option>
              {fields.map((f) => (
                <option key={f}>{f}</option>
              ))}
            </select>
            <select
              value={w.op}
              onChange={(e) => {
                const v = [...whereClauses];
                v[i].op = e.target.value;
                setWhereClauses(v);
              }}
              className="bg-gray-900 text-white p-2 rounded"
            >
              <option>=</option>
              <option>!=</option>
              <option>&gt;</option>
              <option>&lt;</option>
              <option>LIKE</option>
            </select>
            <input
              className="bg-gray-900 text-white p-2 rounded flex-1"
              placeholder="Значение"
              value={w.value}
              onChange={(e) => {
                const v = [...whereClauses];
                v[i].value = e.target.value;
                setWhereClauses(v);
              }}
            />
            <button
              className="bg-red-700 hover:bg-red-800 text-white rounded px-2 py-1"
              onClick={() => removeWhere(i)}
            >
              ❌
            </button>
          </div>
        ))}
      </div>

      {/* ORDER BY */}
      <div className="space-y-2">
        <div className="flex justify-between items-center">
          <span>ORDER BY</span>
          <button
            className="bg-gray-700 hover:bg-gray-800 rounded px-2 py-1"
            onClick={handleAddOrder}
          >
            + Добавить ORDER
          </button>
        </div>
        {orderClauses.map((o, i) => (
          <div key={i} className="flex gap-2 items-center">
            <select
              value={o.field}
              onChange={(e) => {
                const v = [...orderClauses];
                v[i].field = e.target.value;
                setOrderClauses(v);
              }}
              className="bg-gray-900 text-white p-2 rounded w-1/3"
            >
              <option value="">Поле</option>
              {fields.map((f) => (
                <option key={f}>{f}</option>
              ))}
            </select>
            <select
              value={o.direction}
              onChange={(e) => {
                const v = [...orderClauses];
                v[i].direction = e.target.value;
                setOrderClauses(v);
              }}
              className="bg-gray-900 text-white p-2 rounded"
            >
              <option>ASC</option>
              <option>DESC</option>
            </select>
            <button
              className="bg-red-700 hover:bg-red-800 text-white rounded px-2 py-1"
              onClick={() => removeOrder(i)}
            >
              ❌
            </button>
          </div>
        ))}
      </div>

      {/* GROUP BY */}
      <div className="space-y-2">
        <div className="flex justify-between items-center">
          <span>GROUP BY</span>
          <button
            className="bg-gray-700 hover:bg-gray-800 rounded px-2 py-1"
            onClick={handleAddGroup}
          >
            + Добавить GROUP
          </button>
        </div>
        {groupFields.map((g, i) => (
          <div key={i} className="flex items-center gap-2">
            <select
              value={g}
              onChange={(e) => {
                const v = [...groupFields];
                v[i] = e.target.value;
                setGroupFields(v);
              }}
              className="bg-gray-900 text-white p-2 rounded w-1/3"
            >
              <option value="">Поле</option>
              {fields.map((f) => (
                <option key={f}>{f}</option>
              ))}
            </select>
            <button
              className="bg-red-700 hover:bg-red-800 text-white rounded px-2 py-1"
              onClick={() => removeGroup(i)}
            >
              ❌
            </button>
          </div>
        ))}
      </div>

      {/* LIMIT */}
      <div>
        <label>LIMIT:</label>
        <input
          type="number"
          className="w-full bg-gray-900 text-white rounded p-2 mt-1"
          value={limit || ""}
          onChange={(e) => setLimit(Number(e.target.value))}
          placeholder="Например: 100"
        />
      </div>

      {/* Выполнить */}
      <div className="pt-4">
        <button
          className="w-full bg-green-700 hover:bg-green-800 text-white text-lg rounded py-2"
          onClick={handleExecute}
        >
          ⚡ Выполнить SQL
        </button>
      </div>
    </div>
  );
}
