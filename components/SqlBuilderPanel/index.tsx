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
  const [dbName, setDbName] = useState<string>("");
  const [connectionString, setConnectionString] = useState<string>("");
  const [dbType, setDbType] = useState<string>("postgres");
  const [selectedDb, setSelectedDb] = useState<string>("default");

  const [queryType, setQueryType] = useState<string>("SELECT");
  const [table, setTable] = useState<string>("users");
  const [fields, setFields] = useState<string[]>(["id", "name", "email"]);
  const [joins, setJoins] = useState<SqlJoin[]>([]);
  const [filters, setFilters] = useState<SqlFilter[]>([]);
  const [orderBy, setOrderBy] = useState<SqlOrder[]>([]);
  const [transaction, setTransaction] = useState<boolean>(false);
  const [generatedSQL, setGeneratedSQL] = useState<string>("");

  useEffect(() => {
    const saved = localStorage.getItem("savedDatabases");
    if (saved) setDatabases(JSON.parse(saved));
  }, []);

  const handleAddDatabase = () => {
    if (!dbName || !connectionString.trim()) return alert("Введите имя и строку подключения!");
    const updated = [...databases, { name: dbName, connection: connectionString, dbType }];
    setDatabases(updated);
    localStorage.setItem("savedDatabases", JSON.stringify(updated));
    setDbName("");
    setConnectionString("");
  };

  const handleGenerateSQL = async () => {
    const jsonQuery = { table, fields, joins, filters, orderBy, transaction };
    const sql = jsonToSql(jsonQuery as any);
    setGeneratedSQL(sql);

    if (onExecute) {
      await onExecute(jsonQuery);
    }
  };

  return (
    <div className="sql-builder-panel improved">
      <h2 className="panel-title">🧠 Визуальный SQL Конструктор</h2>

      <div className="builder-grid two-columns">
        {/* Левая колонка */}
        <div className="builder-left">
          <div className="input-group small">
            <label>База данных:</label>
            <select value={selectedDb} onChange={(e) => setSelectedDb(e.target.value)}>
              <option value="default">Текущая (по умолчанию)</option>
              {databases.map((db, i) => (
                <option key={i} value={db.connection}>
                  {db.name} ({db.dbType})
                </option>
              ))}
              <option value="new">➕ Добавить новую</option>
            </select>
          </div>

          {selectedDb === "new" && (
            <div className="db-add-block">
              <div className="input-group small">
                <label>Имя подключения:</label>
                <input
                  type="text"
                  value={dbName}
                  onChange={(e) => setDbName(e.target.value)}
                  placeholder="Например: TestDB"
                />
              </div>

              <div className="input-group small">
                <label>Connection String:</label>
                <input
                  type="text"
                  value={connectionString}
                  onChange={(e) => setConnectionString(e.target.value)}
                  placeholder="postgresql://user:pass@host/db"
                />
              </div>

              <div className="input-group small">
                <label>SQL модель:</label>
                <select value={dbType} onChange={(e) => setDbType(e.target.value)}>
                  <option value="postgres">PostgreSQL</option>
                  <option value="mysql">MySQL</option>
                  <option value="sqlite">SQLite</option>
                  <option value="mssql">MS SQL</option>
                  <option value="oracle">Oracle</option>
                </select>
              </div>

              <button className="add-btn save-db" onClick={handleAddDatabase}>
                💾 Сохранить подключение
              </button>
            </div>
          )}

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
            <input
              type="text"
              value={table}
              onChange={(e) => setTable(e.target.value)}
              placeholder="users"
            />
          </div>

          <div className="input-group small">
            <label>Поля:</label>
            {fields.map((field, i) => (
              <input
                key={i}
                type="text"
                value={field}
                onChange={(e) => {
                  const updated = [...fields];
                  updated[i] = e.target.value;
                  setFields(updated);
                }}
              />
            ))}
            <button className="add-btn" onClick={() => setFields([...fields, ""])}>➕ Добавить поле</button>
          </div>
        </div>

        {/* Правая колонка */}
        <div className="builder-right">
          <div className="input-group small">
            <label>WHERE:</label>
            {filters.map((f, i) => (
              <div key={i} className="filter-row compact-row">
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
        <button onClick={handleGenerateSQL}>⚡ Сгенерировать SQL</button>
      </div>

      <div className="sql-output">
        <h3>🧾 Сгенерированный SQL:</h3>
        <pre>{generatedSQL}</pre>
      </div>
    </div>
  );
}
