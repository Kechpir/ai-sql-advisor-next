import React, { useState, useEffect } from "react";
import { jsonToSql } from "../../utils/jsonToSql";
import { Button } from "../ui/button";

interface SqlFilter {
  field: string;
  op: string;
  value: string;
}

interface SqlOrder {
  field: string;
  direction: "ASC" | "DESC";
}

export default function SqlBuilderPanel({ onExecute }: { onExecute: (q: any) => void }) {
  const [connectionString, setConnectionString] = useState("");
  const [schema, setSchema] = useState<Record<string, any[]> | null>(null);
  const [selectedTable, setSelectedTable] = useState("");
  const [fields, setFields] = useState<string[]>([]);
  const [filters, setFilters] = useState<SqlFilter[]>([]);
  const [orderBy, setOrderBy] = useState<SqlOrder[]>([]);
  const [generatedSQL, setGeneratedSQL] = useState("");
  const [loading, setLoading] = useState(false);

  // 🔹 Загрузка схемы таблиц
  const fetchSchema = async () => {
    if (!connectionString) return;
    setLoading(true);
    try {
      const res = await fetch("/api/fetch-schema", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ connectionString }),
      });
      const data = await res.json();
      if (data.success) setSchema(data.schema);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  // 🔹 Генерация и выполнение SQL
  const handleExecute = () => {
    const query = {
      dbType: "postgres",
      queryType: "SELECT",
      table: selectedTable,
      fields,
      filters,
      orderBy,
    };
    const sql = jsonToSql(query);
    setGeneratedSQL(sql);
    onExecute(query);
  };

  return (
    <div className="p-6 bg-[#0B1221] text-gray-100 rounded-2xl shadow-xl border border-[#1e2b46]">
      <h2 className="text-2xl font-semibold mb-6 text-cyan-400 drop-shadow-[0_0_6px_rgba(0,255,255,0.7)]">
        🧠 Визуальный SQL Конструктор
      </h2>

      {/* Подключение */}
      <div className="flex gap-2 mb-4">
        <input
          value={connectionString}
          onChange={(e) => setConnectionString(e.target.value)}
          placeholder="postgres://user:password@host/db"
          className="flex-1 p-2 rounded bg-[#101a33] border border-[#233861] focus:ring-2 focus:ring-cyan-500 text-sm"
        />
        <Button onClick={fetchSchema} variant="primary">
          🔄 Подключить / Обновить
        </Button>
      </div>

      {/* Таблицы */}
      <div className="mb-4">
        <label className="block text-sm mb-1 text-cyan-300">Таблица:</label>
        <select
          className="w-full bg-[#101a33] border border-[#233861] rounded p-2 focus:ring-2 focus:ring-cyan-500"
          value={selectedTable}
          onChange={(e) => {
            setSelectedTable(e.target.value);
            if (schema && schema[e.target.value]) {
              setFields(schema[e.target.value].map((col) => col.column));
            }
          }}
        >
          <option value="">— выберите таблицу —</option>
          {schema &&
            Object.keys(schema).map((table) => (
              <option key={table} value={table}>
                {table}
              </option>
            ))}
        </select>
      </div>

      {/* Поля */}
      <div className="mb-4">
        <label className="block text-sm mb-1 text-cyan-300">Поля:</label>
        {fields.map((f, i) => (
          <div key={i} className="flex gap-2 mb-2">
            <input
              value={f}
              onChange={(e) => {
                const updated = [...fields];
                updated[i] = e.target.value;
                setFields(updated);
              }}
              className="flex-1 bg-[#101a33] border border-[#233861] rounded p-2 text-sm"
            />
            <Button
              onClick={() => setFields(fields.filter((_, idx) => idx !== i))}
              variant="danger"
            >
              ✖
            </Button>
          </div>
        ))}
        <Button
          onClick={() => setFields([...fields, ""])}
          variant="ghost"
          className="mt-2"
        >
          ➕ Добавить поле
        </Button>
      </div>

      {/* WHERE */}
      <div className="mb-4">
        <label className="block text-sm mb-1 text-cyan-300">WHERE:</label>
        {filters.map((f, i) => (
          <div key={i} className="flex gap-2 mb-2">
            <input
              value={f.field}
              onChange={(e) => {
                const updated = [...filters];
                updated[i].field = e.target.value;
                setFilters(updated);
              }}
              placeholder="Поле"
              className="flex-1 bg-[#101a33] border border-[#233861] rounded p-2 text-sm"
            />
            <select
              value={f.op}
              onChange={(e) => {
                const updated = [...filters];
                updated[i].op = e.target.value;
                setFilters(updated);
              }}
              className="bg-[#101a33] border border-[#233861] rounded p-2 text-sm"
            >
              <option>=</option>
              <option>!=</option>
              <option>&gt;</option>
              <option>&lt;</option>
              <option>LIKE</option>
            </select>
            <input
              value={f.value}
              onChange={(e) => {
                const updated = [...filters];
                updated[i].value = e.target.value;
                setFilters(updated);
              }}
              placeholder="Значение"
              className="flex-1 bg-[#101a33] border border-[#233861] rounded p-2 text-sm"
            />
            <Button
              onClick={() => setFilters(filters.filter((_, idx) => idx !== i))}
              variant="danger"
            >
              ✖
            </Button>
          </div>
        ))}
        <Button
          onClick={() => setFilters([...filters, { field: "", op: "=", value: "" }])}
          variant="ghost"
        >
          ➕ Добавить фильтр
        </Button>
      </div>

      {/* ORDER */}
      <div className="mb-6">
        <label className="block text-sm mb-1 text-cyan-300">ORDER BY:</label>
        {orderBy.map((o, i) => (
          <div key={i} className="flex gap-2 mb-2">
            <input
              value={o.field}
              onChange={(e) => {
                const updated = [...orderBy];
                updated[i].field = e.target.value;
                setOrderBy(updated);
              }}
              placeholder="Поле"
              className="flex-1 bg-[#101a33] border border-[#233861] rounded p-2 text-sm"
            />
            <select
              value={o.direction}
              onChange={(e) => {
                const updated = [...orderBy];
                updated[i].direction = e.target.value as "ASC" | "DESC";
                setOrderBy(updated);
              }}
              className="bg-[#101a33] border border-[#233861] rounded p-2 text-sm"
            >
              <option>ASC</option>
              <option>DESC</option>
            </select>
            <Button
              onClick={() => setOrderBy(orderBy.filter((_, idx) => idx !== i))}
              variant="danger"
            >
              ✖
            </Button>
          </div>
        ))}
        <Button
          onClick={() => setOrderBy([...orderBy, { field: "", direction: "ASC" }])}
          variant="ghost"
        >
          ➕ Добавить ORDER
        </Button>
      </div>

      {/* Выполнить */}
      <div className="flex justify-end">
        <Button
          onClick={handleExecute}
          disabled={loading}
          variant="primary"
          className="px-6 py-2 font-semibold"
        >
          ⚡ {loading ? "Загрузка..." : "Выполнить SQL"}
        </Button>
      </div>

      {/* SQL */}
      {generatedSQL && (
        <div className="mt-5 bg-[#0f1a2e] p-3 rounded-lg border border-[#1e3558] text-xs text-cyan-200">
          <div className="mb-1 font-semibold text-gray-300">🧾 Сгенерированный SQL:</div>
          <pre className="whitespace-pre-wrap">{generatedSQL}</pre>
        </div>
      )}
    </div>
  );
}
