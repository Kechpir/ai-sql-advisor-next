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
        joins,
        transaction,
      };

      const sql = jsonToSql(jsonQuery);
      setGeneratedSQL(sql);
      if (onExecute) onExecute(jsonQuery);
    } catch (err) {
      setGeneratedSQL(`Ошибка: ${(err as Error).message}`);
    }
  };

  return (
    <div className="sql-builder-panel compact">
      <h2 className="panel-title">🧠 Визуальный SQL Конструктор</h2>

      <div className="builder-grid compact-grid">
        {/* ЛЕВАЯ КОЛОНКА */}
        <div className="builder-left">
          <div className="input-group small">
            <label>База данных:</label>
            <select value={selectedDb} onChange={(e) => setSelectedDb(e.target.value)}>
              <option value="default">Текущая (по умолчанию)</option>
              {databases.map((db, i) => (
                <option key={i} value={db.connection}>
                  {db.connection.length > 45 ? db.connection.slice(0, 45) + "..." : db.connection}
                </option>
              ))}
              <option value="new">➕ Новая</option>
            </select>
          </div>

          {selectedDb === "new" && (
            <>
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
              <button className="add-btn">✅ Сохранить</button>
            </>
          )}

          <div className="input-group small">
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

          <div className="input-group small">
            <label>Таблица:</label>
            <input value={table} onChange={(e) => setTable(e.target.value)} />
          </div>

          <div className="input-group small">
            <label>Поля / Aggregate:</label>
            {fields.map((field, i) => (
              <div key={i} className="field-agg-row compact-row">
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
            <button className="add-btn small">➕ Поле</button>
          </div>

          <div className="input-group small">
            <label>JOIN:</label>
            {joins.map((j, i) => (
              <div key={i} className="join-row compact-row">
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
                </select>
                <input
                  type="text"
                  placeholder="таблица"
                  value={j.table}
                  onChange={(e) => {
                    const updated = [...joins];
                    updated[i].table = e.target.value;
                    setJoins(updated);
                  }}
                />
              </div>
            ))}
            <button className="add-btn small" onClick={() => setJoins([...joins, { type: "INNER", table: "", on: "" }])}>
              ➕ JOIN
            </button>
          </div>
        </div>

        {/* ПРАВАЯ КОЛОНКА */}
        <div className="builder-right">
          <div className="filters-section small">
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
            <button className="add-btn small" onClick={() => setFilters([...filters, { field: "", op: "=", value: "" }])}>
              ➕ Фильтр
            </button>
          </div>

          <div className="order-section small">
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
                    updated[i].direction = e.target.value as any;
                    setOrderBy(updated);
                  }}
                >
                  <option value="ASC">ASC</option>
                  <option value="DESC">DESC</option>
                </select>
              </div>
            ))}
            <button className="add-btn small" onClick={() => setOrderBy([...orderBy, { field: "", direction: "ASC" }])}>
              ➕ ORDER
            </button>
          </div>

          <div className="input-group checkbox small">
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

      <div className="action-group small">
        <button onClick={handleGenerateSQL}>⚡ Сгенерировать SQL</button>
      </div>

      <div className="sql-output">
        <h3>🧾 Сгенерированный SQL:</h3>
        <pre>{generatedSQL}</pre>
      </div>
    </div>
  );
}
