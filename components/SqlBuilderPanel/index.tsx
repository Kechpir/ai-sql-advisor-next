import React, { useState, useEffect } from "react";
import { jsonToSql } from "../../utils/jsonToSql";

interface SqlJoin {
  type: "INNER" | "LEFT" | "RIGHT" | "FULL";
  table: string;
  on: string;
}

interface SqlFilter {
  field: string;
  op: string;
  value: string;
}

interface SqlOrder {
  field: string;
  direction: "ASC" | "DESC";
}

interface SqlBuilderPanelProps {
  onExecute: (query: any) => Promise<void> | void;
}

export default function SqlBuilderPanel({ onExecute }: SqlBuilderPanelProps) {
  const [schema, setSchema] = useState<Record<string, any[]> | null>(null);
  const [selectedTable, setSelectedTable] = useState<string>("");
  const [fields, setFields] = useState<string[]>([]);
  const [filters, setFilters] = useState<SqlFilter[]>([]);
  const [orderBy, setOrderBy] = useState<SqlOrder[]>([]);
  const [joins, setJoins] = useState<SqlJoin[]>([]);
  const [groupBy, setGroupBy] = useState<string[]>([]);
  const [aggFunc, setAggFunc] = useState<string>("");
  const [transaction, setTransaction] = useState<boolean>(false);
  const [generatedSQL, setGeneratedSQL] = useState<string>("");

  // 🚀 Подгружаем схему при старте
  useEffect(() => {
    fetchSchema();
  }, []);

  const fetchSchema = async () => {
    try {
      const res = await fetch("/api/fetch-schema");
      const data = await res.json();
      if (data.success) {
        setSchema(data.schema);
      } else {
        console.error("Ошибка загрузки схемы:", data.error);
      }
    } catch (e) {
      console.error("Ошибка запроса схемы:", e);
    }
  };

  const handleGenerateSQL = async () => {
    const jsonQuery = {
      queryType: "SELECT",
      table: selectedTable,
      fields,
      filters,
      orderBy,
      joins,
      groupBy,
      transaction,
      aggFunc,
    };

    const sql = jsonToSql(jsonQuery as any);
    setGeneratedSQL(sql);

    if (onExecute) {
      await onExecute(jsonQuery);
    }
  };

  // 🔧 UI helpers
  const addField = () => setFields([...fields, ""]);
  const removeField = (index: number) => setFields(fields.filter((_, i) => i !== index));
  const addFilter = () => setFilters([...filters, { field: "", op: "=", value: "" }]);
  const removeFilter = (index: number) => setFilters(filters.filter((_, i) => i !== index));
  const addOrder = () => setOrderBy([...orderBy, { field: "", direction: "ASC" }]);
  const removeOrder = (index: number) => setOrderBy(orderBy.filter((_, i) => i !== index));
  const addJoin = () => setJoins([...joins, { type: "INNER", table: "", on: "" }]);
  const removeJoin = (index: number) => setJoins(joins.filter((_, i) => i !== index));

  return (
    <div className="bg-gray-900 p-6 rounded-2xl shadow-lg text-gray-100">
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-xl font-bold">🧠 Визуальный SQL Конструктор</h2>
        <button
          onClick={fetchSchema}
          className="bg-blue-600 hover:bg-blue-500 px-3 py-1 rounded text-sm"
        >
          🔄 Обновить схему
        </button>
      </div>

      <div className="grid grid-cols-2 gap-6">
        {/* Левая колонка */}
        <div>
          <div className="mb-4">
            <label className="block text-sm mb-1">📋 Таблица:</label>
            <select
              className="w-full bg-gray-800 border border-gray-700 rounded p-2"
              value={selectedTable}
              onChange={(e) => {
                const table = e.target.value;
                setSelectedTable(table);
                if (schema && schema[table]) {
                  setFields(schema[table].map((f) => f.column));
                }
              }}
            >
              <option value="">— выберите таблицу —</option>
              {schema &&
                Object.keys(schema).map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
            </select>
          </div>

          <div className="mb-4">
            <label className="block text-sm mb-1">📊 Поля:</label>
            {fields.map((f, i) => (
              <div key={i} className="flex gap-2 mb-1">
                <select
                  value={f}
                  onChange={(e) => {
                    const updated = [...fields];
                    updated[i] = e.target.value;
                    setFields(updated);
                  }}
                  className="flex-1 bg-gray-800 border border-gray-700 rounded p-2"
                >
                  <option value="">— выберите поле —</option>
                  {schema &&
                    selectedTable &&
                    schema[selectedTable]?.map((col) => (
                      <option key={col.column} value={col.column}>
                        {col.column}
                      </option>
                    ))}
                </select>
                <button
                  onClick={() => removeField(i)}
                  className="bg-red-600 hover:bg-red-700 px-2 rounded"
                >
                  ✖
                </button>
              </div>
            ))}
            <button
              onClick={addField}
              className="bg-gray-700 hover:bg-gray-600 px-3 py-1 rounded text-sm mt-1"
            >
              ➕ Добавить поле
            </button>
          </div>

          {/* GROUP BY */}
          <div className="mb-4">
            <label className="block text-sm mb-1">🧩 GROUP BY:</label>
            <input
              className="w-full bg-gray-800 border border-gray-700 rounded p-2"
              placeholder="Например: category_id"
              value={groupBy.join(", ")}
              onChange={(e) => setGroupBy(e.target.value.split(",").map((s) => s.trim()))}
            />
          </div>

          {/* Агрегат */}
          <div className="mb-4">
            <label className="block text-sm mb-1">Σ Агрегатная функция:</label>
            <select
              value={aggFunc}
              onChange={(e) => setAggFunc(e.target.value)}
              className="w-full bg-gray-800 border border-gray-700 rounded p-2"
            >
              <option value="">— без агрегата —</option>
              <option value="COUNT">COUNT</option>
              <option value="SUM">SUM</option>
              <option value="AVG">AVG</option>
              <option value="MAX">MAX</option>
              <option value="MIN">MIN</option>
            </select>
          </div>
        </div>

        {/* Правая колонка */}
        <div>
          {/* WHERE */}
          <div className="mb-4">
            <label className="block text-sm mb-1">⚙️ WHERE:</label>
            {filters.map((f, i) => (
              <div key={i} className="flex gap-2 mb-1">
                <input
                  type="text"
                  placeholder="Поле"
                  value={f.field}
                  onChange={(e) => {
                    const updated = [...filters];
                    updated[i].field = e.target.value;
                    setFilters(updated);
                  }}
                  className="flex-1 bg-gray-800 border border-gray-700 rounded p-2"
                />
                <select
                  value={f.op}
                  onChange={(e) => {
                    const updated = [...filters];
                    updated[i].op = e.target.value;
                    setFilters(updated);
                  }}
                  className="bg-gray-800 border border-gray-700 rounded p-2"
                >
                  <option>=</option>
                  <option>!=</option>
                  <option>&gt;</option>
                  <option>&lt;</option>
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
                  className="flex-1 bg-gray-800 border border-gray-700 rounded p-2"
                />
                <button
                  onClick={() => removeFilter(i)}
                  className="bg-red-600 hover:bg-red-700 px-2 rounded"
                >
                  ✖
                </button>
              </div>
            ))}
            <button
              onClick={addFilter}
              className="bg-gray-700 hover:bg-gray-600 px-3 py-1 rounded text-sm mt-1"
            >
              ➕ Добавить фильтр
            </button>
          </div>

          {/* ORDER */}
          <div className="mb-4">
            <label className="block text-sm mb-1">↕ ORDER BY:</label>
            {orderBy.map((o, i) => (
              <div key={i} className="flex gap-2 mb-1">
                <input
                  type="text"
                  placeholder="Поле"
                  value={o.field}
                  onChange={(e) => {
                    const updated = [...orderBy];
                    updated[i].field = e.target.value;
                    setOrderBy(updated);
                  }}
                  className="flex-1 bg-gray-800 border border-gray-700 rounded p-2"
                />
                <select
                  value={o.direction}
                  onChange={(e) => {
                    const updated = [...orderBy];
                    updated[i].direction = e.target.value as "ASC" | "DESC";
                    setOrderBy(updated);
                  }}
                  className="bg-gray-800 border border-gray-700 rounded p-2"
                >
                  <option value="ASC">ASC</option>
                  <option value="DESC">DESC</option>
                </select>
                <button
                  onClick={() => removeOrder(i)}
                  className="bg-red-600 hover:bg-red-700 px-2 rounded"
                >
                  ✖
                </button>
              </div>
            ))}
            <button
              onClick={addOrder}
              className="bg-gray-700 hover:bg-gray-600 px-3 py-1 rounded text-sm mt-1"
            >
              ➕ Добавить ORDER
            </button>
          </div>
        </div>
      </div>

      {/* Выполнить */}
      <div className="mt-6 flex justify-between items-center">
        <label className="text-sm flex items-center gap-2">
          <input
            type="checkbox"
            checked={transaction}
            onChange={(e) => setTransaction(e.target.checked)}
          />
          Использовать транзакцию (BEGIN / COMMIT)
        </label>
        <button
          onClick={handleGenerateSQL}
          className="bg-green-600 hover:bg-green-500 px-4 py-2 rounded font-semibold"
        >
          ⚡ Выполнить SQL
        </button>
      </div>

      {/* SQL */}
      {generatedSQL && (
        <div className="mt-4 bg-gray-800 p-3 rounded border border-gray-700 text-sm text-gray-300">
          <div className="mb-1 font-semibold text-gray-400">🧾 Сгенерированный SQL:</div>
          <pre className="whitespace-pre-wrap">{generatedSQL}</pre>
        </div>
      )}
    </div>
  );
}
