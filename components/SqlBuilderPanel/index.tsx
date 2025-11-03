import React, { useState, useEffect } from "react";
import { jsonToSql } from "../../utils/jsonToSql";

interface SqlBuilderPanelProps {
  onExecute?: (query: any) => void;
}

export default function SqlBuilderPanel({ onExecute }: SqlBuilderPanelProps) {

  const [databases, setDatabases] = useState<{ connection: string; dbType: string }[]>([]);
  const [selectedDb, setSelectedDb] = useState<string>("default");
  const [connectionString, setConnectionString] = useState<string>("");
  const [dbType, setDbType] = useState<string>("postgres");
  const [queryType, setQueryType] = useState<string>("SELECT");
  const [table, setTable] = useState("users");
  const [fields, setFields] = useState<string[]>(["id", "name", "email"]);
  const [filters, setFilters] = useState<{ field: string; op: string; value: string }[]>([]);
  const [orderBy, setOrderBy] = useState<{ field: string; direction: "ASC" | "DESC" }[]>([]);
  const [groupBy, setGroupBy] = useState<string[]>([]);
  const [joins, setJoins] = useState<{ type: "INNER" | "LEFT" | "RIGHT" | "FULL"; table: string; on: string }[]>([]);
  const [aggregateFunctions, setAggregateFunctions] = useState<Record<string, string>>({});
  const [transaction, setTransaction] = useState(false);
  const [generatedSQL, setGeneratedSQL] = useState("");

  useEffect(() => {
    const saved = localStorage.getItem("savedDatabases");
    if (saved) setDatabases(JSON.parse(saved));
  }, []);

  const handleAddDatabase = () => {
    if (!connectionString.trim()) return alert("Введите строку подключения!");
    const updated = [...databases, { connection: connectionString.trim(), dbType }];
    setDatabases(updated);
    localStorage.setItem("savedDatabases", JSON.stringify(updated));
    setConnectionString("");
    setSelectedDb(connectionString.trim());
  };

  const handleGenerateSQL = () => {
    try {
      const processedFields = fields.map((f) => {
        const func = aggregateFunctions[f];
        return func ? `${func}(${f})` : f;
      });

      const jsonQuery = {
        database: selectedDb,
        dbType,
        queryType,
        table,
        fields: processedFields,
        filters,
        orderBy,
        groupBy,
        joins,
        transaction,
      };

      const sql = jsonToSql(jsonQuery);
      setGeneratedSQL(sql);
    } catch (err) {
      setGeneratedSQL(`Ошибка: ${(err as Error).message}`);
    }
  };

  return (
    <div className="sql-builder-panel">
      <h2 className="panel-title">🧠 Визуальный SQL Конструктор</h2>

      <div className="builder-grid">
        {/* ЛЕВАЯ КОЛОНКА */}
        <div className="builder-left">
          <div className="input-group">
            <label>Выбор базы данных:</label>
            <select value={selectedDb} onChange={(e) => setSelectedDb(e.target.value)}>
              <option value="default">🔘 Текущая (по умолчанию)</option>
              {databases.map((db, i) => (
                <option key={i} value={db.connection}>
                  {db.connection.length > 50 ? db.connection.slice(0, 50) + "..." : db.connection}
                </option>
              ))}
              <option value="new">➕ Подключить новую</option>
            </select>
          </div>

          {selectedDb === "new" && (
            <>
              <div className="input-group">
                <label>Connection String:</label>
                <input
                  type="text"
                  value={connectionString}
                  onChange={(e) => setConnectionString(e.target.value)}
                  placeholder="postgresql://user:pass@host:port/db"
                />
              </div>
              <div className="input-group">
                <label>Модель SQL:</label>
                <select value={dbType} onChange={(e) => setDbType(e.target.value)}>
                  <option value="postgres">PostgreSQL</option>
                  <option value="mysql">MySQL</option>
                  <option value="sqlite">SQLite</option>
                  <option value="mssql">MS SQL Server</option>
                  <option value="oracle">Oracle SQL</option>
                </select>
              </div>
              <button className="add-btn" onClick={handleAddDatabase}>✅ Сохранить подключение</button>
            </>
          )}

          <div className="input-group">
            <label>Тип SQL-запроса:</label>
            <select value={queryType} onChange={(e) => setQueryType(e.target.value)}>
              <option value="SELECT">SELECT</option>
              <option value="INSERT">INSERT</option>
              <option value="UPDATE">UPDATE</option>
              <option value="DELETE">DELETE</option>
              <option value="ALTER">ALTER</option>
              <option value="CREATE">CREATE</option>
              <option value="DROP">DROP</option>
            </select>
          </div>

          <div className="input-group">
            <label>Таблица:</label>
            <input value={table} onChange={(e) => setTable(e.target.value)} />
          </div>

          <div className="input-group">
            <label>Поля SELECT / Aggregate:</label>
            {fields.map((field, i) => (
              <div key={i} className="field-agg-row">
                <input
                  type="text"
                  value={field}
                  onChange={(e) => {
                    const updated = [...fields];
                    updated[i] = e.target.value;
                    setFields(updated);
                  }}
                />
                <select
                  value={aggregateFunctions[field] || ""}
                  onChange={(e) =>
                    setAggregateFunctions({ ...aggregateFunctions, [field]: e.target.value })
                  }
                >
                  <option value="">—</option>
                  <option value="SUM">SUM</option>
                  <option value="AVG">AVG</option>
                  <option value="COUNT">COUNT</option>
                  <option value="MIN">MIN</option>
                  <option value="MAX">MAX</option>
                </select>
              </div>
            ))}
            <button className="add-btn" onClick={() => setFields([...fields, ""])}>➕ Добавить поле</button>
          </div>

          <div className="input-group">
            <label>Объединения (JOIN):</label>
            {joins.map((j, i) => (
              <div key={i} className="join-row">
                <select
                  value={j.type}
                  onChange={(e) => {
                    const updated = [...joins];
                    updated[i].type = e.target.value as any;
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
                  placeholder="Таблица"
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
            <button className="add-btn" onClick={() => setJoins([...joins, { type: "INNER", table: "", on: "" }])}>➕ Добавить JOIN</button>
          </div>
        </div>

        {/* ПРАВАЯ КОЛОНКА */}
        <div className="builder-right">
          <div className="filters-section">
            <label>Фильтры (WHERE):</label>
            {filters.map((f, i) => (
              <div key={i} className="filter-row">
                <input
                  type="text"
                  placeholder="Поле"
                  value={f.field}
                  onChange={(e) => {
                    const updated = [...filters];
                    updated[i].field = e.target.value;
                    setFilters(updated);
                  }}
                />
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
                  <option>&gt;=</option>
                  <option>&lt;=</option>
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

          <div className="order-section">
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
                    updated[i].direction = e.target.value as any;
                    setOrderBy(updated);
                  }}
                >
                  <option value="ASC">ASC</option>
                  <option value="DESC">DESC</option>
                </select>
              </div>
            ))}
            <button className="add-btn" onClick={() => setOrderBy([...orderBy, { field: "", direction: "ASC" }])}>
              ➕ Добавить сортировку
            </button>
          </div>

          <div className="input-group checkbox">
            <label>
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
        <button onClick={handleGenerateSQL}>⚡ Сгенерировать SQL</button>
      </div>

      <div className="sql-output">
        <h3>🧾 Сгенерированный SQL:</h3>
        <pre>{generatedSQL}</pre>
      </div>
    </div>
  );
}
