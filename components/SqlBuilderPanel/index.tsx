import React, { useState, useEffect } from "react";
import { Button } from "../ui/button";
import "@/styles/sql-interface.css";

interface SqlFilter {
  field: string;
  op: string;
  value: string;
}

interface SqlOrder {
  field: string;
  direction: "ASC" | "DESC";
}

interface SqlJoin {
  type: string;
  table: string;
  field1: string;
  field2: string;
}

export default function SqlBuilderPanel({ onExecute }: { onExecute: (q: any) => void }) {
  const [connectionString, setConnectionString] = useState("");
  const [dialect, setDialect] = useState("postgres");
  const [schema, setSchema] = useState<Record<string, string[]> | null>(null);
  const [queryType, setQueryType] = useState("SELECT");
  const [selectedTable, setSelectedTable] = useState("");
  const [fields, setFields] = useState<string[]>([]);
  const [filters, setFilters] = useState<SqlFilter[]>([]);
  const [joins, setJoins] = useState<SqlJoin[]>([]);
  const [orderBy, setOrderBy] = useState<SqlOrder[]>([]);
  const [limit, setLimit] = useState<number>(50);
  const [offset, setOffset] = useState<number>(0);
  const [transaction, setTransaction] = useState(false);
  const [generatedSQL, setGeneratedSQL] = useState("");
  const [loading, setLoading] = useState(false);

  // === Fetch schema ===
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

  // === Generate and execute SQL ===
  const handleExecute = () => {
    const query = {
      dbType: dialect,
      queryType,
      table: selectedTable,
      fields,
      filters,
      joins,
      orderBy,
      limit,
      offset,
      transactionMode: transaction,
    };
    setGeneratedSQL(JSON.stringify(query, null, 2));
    onExecute(query);
  };

  return (
    <div className="sql-builder-panel">
      <h2 className="panel-title">🧠 Визуальный SQL Конструктор</h2>

      {/* Подключение */}
      <div className="input-group">
        <label>🔗 Строка подключения:</label>
        <input
          type="text"
          value={connectionString}
          onChange={(e) => setConnectionString(e.target.value)}
          placeholder="postgres://user:password@host/db"
        />
        <Button onClick={fetchSchema} disabled={loading}>
          {loading ? "Загрузка..." : "Подключить / Обновить"}
        </Button>
      </div>

      {/* Диалект */}
      <div className="input-group">
        <label>⚙️ SQL-диалект:</label>
        <select value={dialect} onChange={(e) => setDialect(e.target.value)}>
          <option value="postgres">PostgreSQL</option>
          <option value="mysql">MySQL</option>
          <option value="sqlite">SQLite</option>
          <option value="sqlserver">SQL Server</option>
          <option value="oracle">Oracle</option>
          <option value="mariadb">MariaDB</option>
          <option value="snowflake">Snowflake</option>
          <option value="redshift">Redshift</option>
        </select>
      </div>

      {/* Тип запроса */}
      <div className="input-group">
        <label>📜 Тип SQL-запроса:</label>
        <select value={queryType} onChange={(e) => setQueryType(e.target.value)}>
          <option>SELECT</option>
          <option>INSERT</option>
          <option>UPDATE</option>
          <option>DELETE</option>
        </select>
      </div>

      {/* Таблица */}
      <div className="input-group">
        <label>📦 Таблица:</label>
        <select
          value={selectedTable}
          onChange={(e) => setSelectedTable(e.target.value)}
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
      <div className="input-group">
        <label>📋 Поля:</label>
        {fields.map((f, i) => (
          <div key={i} className="field-row">
            <select
              value={f}
              onChange={(e) => {
                const updated = [...fields];
                updated[i] = e.target.value;
                setFields(updated);
              }}
            >
              <option value="">— выберите поле —</option>
              {schema?.[selectedTable]?.map((col) => (
                <option key={col} value={col}>
                  {col}
                </option>
              ))}
            </select>
            <button
              className="delete-field-btn"
              onClick={() => setFields(fields.filter((_, idx) => idx !== i))}
            >
              ✖
            </button>
          </div>
        ))}
        <Button onClick={() => setFields([...fields, ""])}>➕ Добавить поле</Button>
      </div>

      {/* WHERE */}
      <div className="input-group">
        <label>🔍 WHERE:</label>
        {filters.map((f, i) => (
          <div key={i} className="field-row">
            <select
              value={f.field}
              onChange={(e) => {
                const updated = [...filters];
                updated[i].field = e.target.value;
                setFilters(updated);
              }}
            >
              <option value="">— поле —</option>
              {schema?.[selectedTable]?.map((col) => (
                <option key={col} value={col}>
                  {col}
                </option>
              ))}
            </select>
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
              <option>LIKE</option>
              <option>BETWEEN</option>
            </select>
            <input
              value={f.value}
              onChange={(e) => {
                const updated = [...filters];
                updated[i].value = e.target.value;
                setFilters(updated);
              }}
              placeholder="Значение"
            />
            <button
              className="delete-field-btn"
              onClick={() => setFilters(filters.filter((_, idx) => idx !== i))}
            >
              ✖
            </button>
          </div>
        ))}
        <Button onClick={() => setFilters([...filters, { field: "", op: "=", value: "" }])}>
          ➕ Добавить фильтр
        </Button>
      </div>

      {/* ORDER BY */}
      <div className="input-group">
        <label>🧭 ORDER BY:</label>
        {orderBy.map((o, i) => (
          <div key={i} className="field-row">
            <select
              value={o.field}
              onChange={(e) => {
                const updated = [...orderBy];
                updated[i].field = e.target.value;
                setOrderBy(updated);
              }}
            >
              <option value="">— выберите поле —</option>
              {schema?.[selectedTable]?.map((col) => (
                <option key={col} value={col}>
                  {col}
                </option>
              ))}
            </select>
            <select
              value={o.direction}
              onChange={(e) => {
                const updated = [...orderBy];
                updated[i].direction = e.target.value as "ASC" | "DESC";
                setOrderBy(updated);
              }}
            >
              <option>ASC</option>
              <option>DESC</option>
            </select>
            <button
              className="delete-field-btn"
              onClick={() => setOrderBy(orderBy.filter((_, idx) => idx !== i))}
            >
              ✖
            </button>
          </div>
        ))}
        <Button onClick={() => setOrderBy([...orderBy, { field: "", direction: "ASC" }])}>
          ➕ Добавить ORDER
        </Button>
      </div>

      {/* LIMIT / OFFSET */}
      <div className="input-group">
        <label>📄 Лимит и смещение:</label>
        <input
          type="number"
          value={limit}
          onChange={(e) => setLimit(Number(e.target.value))}
          placeholder="LIMIT"
        />
        <input
          type="number"
          value={offset}
          onChange={(e) => setOffset(Number(e.target.value))}
          placeholder="OFFSET"
        />
      </div>

      {/* TRANSACTION */}
      <div className="input-group flex items-center gap-2">
        <label>🔒 Включить транзакцию:</label>
        <input
          type="checkbox"
          checked={transaction}
          onChange={(e) => setTransaction(e.target.checked)}
        />
      </div>

      {/* Выполнить */}
      <div className="flex justify-end">
        <Button onClick={handleExecute} className="add-btn">
          ⚡ Выполнить SQL
        </Button>
      </div>

      {/* Сгенерированный SQL */}
      {generatedSQL && (
        <pre className="sql-output mt-4">{generatedSQL}</pre>
      )}
    </div>
  );
}
