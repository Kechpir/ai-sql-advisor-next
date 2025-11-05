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
  onExecute?: (query: any) => Promise<void> | void;
}

export default function SqlBuilderPanel({ onExecute }: SqlBuilderPanelProps) {
  const [databases, setDatabases] = useState<{ name: string; connection: string; dbType: string }[]>([]);
  const [selectedDb, setSelectedDb] = useState<string>("default");
  const [connectionString, setConnectionString] = useState<string>("");
  const [dbType, setDbType] = useState<string>("postgres");

  const [schema, setSchema] = useState<Record<string, string[]>>({});
  const [table, setTable] = useState<string>("");
  const [fields, setFields] = useState<string[]>([]);
  const [queryType, setQueryType] = useState<string>("SELECT");
  const [filters, setFilters] = useState<SqlFilter[]>([]);
  const [orderBy, setOrderBy] = useState<SqlOrder[]>([]);
  const [transaction, setTransaction] = useState<boolean>(false);
  const [generatedSQL, setGeneratedSQL] = useState<string>("");
  const [loadingSchema, setLoadingSchema] = useState<boolean>(false);

  // Загружаем сохранённые подключения из localStorage
  useEffect(() => {
    const saved = localStorage.getItem("savedDatabases");
    if (saved) setDatabases(JSON.parse(saved));
  }, []);

  // 🔹 Подключение к выбранной базе и автоподтягивание схемы
  const handleConnect = async () => {
    const selected = databases.find((db) => db.connection === selectedDb);
    const conn = selected ? selected.connection : connectionString;

    if (!conn) {
      alert("Укажите строку подключения к базе данных");
      return;
    }

    setConnectionString(conn);
    await fetchSchema(conn);
  };

  // 🔄 Обновление схемы вручную
  const fetchSchema = async (conn: string) => {
    try {
      setLoadingSchema(true);
      const res = await fetch("/api/fetch-schema", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ connectionString: conn }),
      });
      const result = await res.json();
      if (!result.success) throw new Error(result.error || "Ошибка загрузки схемы");
      setSchema(result.schema);
      setTable(Object.keys(result.schema)[0] || "");
      setFields(result.schema[Object.keys(result.schema)[0]] || []);
    } catch (err: any) {
      alert("Ошибка при получении схемы: " + err.message);
    } finally {
      setLoadingSchema(false);
    }
  };

  // Генерация SQL и выполнение
  const handleGenerateSQL = async () => {
    const jsonQuery = { table, fields, filters, orderBy, transaction, queryType, dbType };
    const sql = jsonToSql(jsonQuery as any);
    setGeneratedSQL(sql);
    if (onExecute) await onExecute(jsonQuery);
  };

  return (
    <div className="sql-builder-panel improved">
      <h2 className="panel-title">🧠 Визуальный SQL Конструктор</h2>

      <div className="builder-grid two-columns">
        {/* Левая колонка */}
        <div className="builder-left">
          <div className="input-group small">
            <label>Подключение:</label>
            <select value={selectedDb} onChange={(e) => setSelectedDb(e.target.value)}>
              <option value="default">Текущая (по умолчанию)</option>
              {databases.map((db, i) => (
                <option key={i} value={db.connection}>
                  {db.name} ({db.dbType})
                </option>
              ))}
            </select>
            <button onClick={handleConnect} className="add-btn ml-2">🔗 Подключиться</button>
            <button
              onClick={() => fetchSchema(connectionString)}
              className="add-btn ml-2"
              disabled={!connectionString || loadingSchema}
            >
              🔄 Обновить схему
            </button>
          </div>

          <div className="input-group small">
            <label>Тип SQL-запроса:</label>
            <select value={queryType} onChange={(e) => setQueryType(e.target.value)}>
              <option value="SELECT">SELECT</option>
              <option value="INSERT">INSERT</option>
              <option value="UPDATE">UPDATE</option>
              <option value="DELETE">DELETE</option>
            </select>
          </div>

          <div className="input-group small">
            <label>Таблица:</label>
            <select value={table} onChange={(e) => {
              setTable(e.target.value);
              setFields(schema[e.target.value] || []);
            }}>
              <option value="">— выбери таблицу —</option>
              {Object.keys(schema).map((t) => (
                <option key={t} value={t}>{t}</option>
              ))}
            </select>
          </div>

          <div className="input-group small">
            <label>Поля:</label>
            {fields.length === 0 ? (
              <p className="note">Выбери таблицу для отображения полей</p>
            ) : (
              fields.map((field, i) => (
                <div key={i} className="field-row compact-row">
                  <select
                    value={field}
                    onChange={(e) => {
                      const updated = [...fields];
                      updated[i] = e.target.value;
                      setFields(updated);
                    }}
                  >
                    {schema[table]?.map((col) => (
                      <option key={col} value={col}>{col}</option>
                    ))}
                  </select>
                  <button
                    className="remove-btn"
                    onClick={() => setFields(fields.filter((_, idx) => idx !== i))}
                  >
                    ❌
                  </button>
                </div>
              ))
            )}
            <button className="add-btn" onClick={() => setFields([...fields, ""])}>➕ Добавить поле</button>
          </div>
        </div>

        {/* Правая колонка */}
        <div className="builder-right">
          <div className="input-group small">
            <label>WHERE:</label>
            {filters.map((f, i) => (
              <div key={i} className="filter-row compact-row">
                <select
                  value={f.field}
                  onChange={(e) => {
                    const updated = [...filters];
                    updated[i].field = e.target.value;
                    setFilters(updated);
                  }}
                >
                  <option value="">Поле</option>
                  {schema[table]?.map((col) => (
                    <option key={col} value={col}>{col}</option>
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
            <button className="add-btn" onClick={() => setFilters([...filters, { field: "", op: "=", value: "" }])}>
              ➕ Добавить фильтр
            </button>
          </div>

          <div className="input-group small">
            <label>ORDER BY:</label>
            {orderBy.map((o, i) => (
              <div key={i} className="order-row compact-row">
                <select
                  value={o.field}
                  onChange={(e) => {
                    const updated = [...orderBy];
                    updated[i].field = e.target.value;
                    setOrderBy(updated);
                  }}
                >
                  <option value="">Поле</option>
                  {schema[table]?.map((col) => (
                    <option key={col} value={col}>{col}</option>
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
                  <option value="ASC">ASC</option>
                  <option value="DESC">DESC</option>
                </select>
              </div>
            ))}
            <button className="add-btn" onClick={() => setOrderBy([...orderBy, { field: "", direction: "ASC" }])}>
              ➕ Добавить ORDER
            </button>
          </div>

          <div className="transaction-box">
            <label className="transaction-label">
              <input
                type="checkbox"
                checked={transaction}
                onChange={(e) => setTransaction(e.target.checked)}
              />
              Использовать транзакцию (BEGIN / COMMIT)
            </label>
          </div>
        </div>
      </div>

      <div className="action-group">
        <button onClick={handleGenerateSQL}>⚡ Выполнить SQL</button>
      </div>

      <div className="sql-output">
        <h3>🧾 Сгенерированный SQL:</h3>
        <pre>{generatedSQL}</pre>
      </div>
    </div>
  );
}
