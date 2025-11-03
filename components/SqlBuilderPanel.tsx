import React, { useState, useEffect } from "react";
import { jsonToSql } from "../utils/jsonToSql";

interface SqlBuilderPanelProps {
  onExecute?: (query: any) => void;
}

export default function SqlBuilderPanel({ onExecute }: SqlBuilderPanelProps) {
  const [databases, setDatabases] = useState<
    { connection: string; dbType: string }[]
  >([]);
  const [selectedDb, setSelectedDb] = useState<string>("default");
  const [connectionString, setConnectionString] = useState<string>("");
  const [dbType, setDbType] = useState<string>("postgres");

  const [queryType, setQueryType] = useState<string>("SELECT");
  const [table, setTable] = useState("users");
  const [fields, setFields] = useState<string[]>(["id", "name", "email"]);
  const [filters, setFilters] = useState<{ field: string; op: string; value: string }[]>([]);
  const [orderBy, setOrderBy] = useState<{ field: string; direction: "ASC" | "DESC" }[]>([]);
  const [groupBy, setGroupBy] = useState<string[]>([]);
  const [joins, setJoins] = useState<
    { type: "INNER" | "LEFT" | "RIGHT" | "FULL"; table: string; on: string }[]
  >([]);
  const [aggregateFunctions, setAggregateFunctions] = useState<Record<string, string>>({});
  const [transaction, setTransaction] = useState(false);
  const [generatedSQL, setGeneratedSQL] = useState("");

  useEffect(() => {
    const saved = localStorage.getItem("savedDatabases");
    if (saved) setDatabases(JSON.parse(saved));
  }, []);

  const handleAddDatabase = () => {
    if (!connectionString.trim()) return alert("Введите строку подключения!");
    const updated = [
      ...databases,
      { connection: connectionString.trim(), dbType },
    ];
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

      if (onExecute) onExecute(jsonQuery);
    } catch (err) {
      setGeneratedSQL(`Ошибка: ${(err as Error).message}`);
    }
  };

  return (
    <div className="sql-builder-panel">
      <div className="sql-header">
        <button>💾 Сохранить</button>
        <button>🧹 Очистить</button>
        <button>📤 Экспорт SQL</button>
      </div>

      <h2 className="panel-title">🧠 Визуальный SQL Конструктор</h2>

      {/* ============================= */}
      {/* 🔗 Подключение к базе */}
      {/* ============================= */}
      <div className="input-group">
        <label>Выбор базы данных:</label>
        <select
          value={selectedDb}
          onChange={(e) => setSelectedDb(e.target.value)}
          className="db-select"
        >
          <option value="default">🔘 Текущая (по умолчанию)</option>
          {databases.map((db, i) => (
            <option key={i} value={db.connection}>
              {db.connection.length > 60
                ? db.connection.slice(0, 60) + "..."
                : db.connection}
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
              placeholder="postgresql://user:pass@host:port/db?sslmode=require"
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

          <button onClick={handleAddDatabase}>✅ Сохранить подключение</button>
        </>
      )}

      {/* ============================= */}
      {/* ⚙️ Тип SQL-запроса */}
      {/* ============================= */}
      <div className="input-group">
        <label>Тип запроса:</label>
        <select value={queryType} onChange={(e) => setQueryType(e.target.value)}>
          <option value="SELECT">SELECT (Выборка)</option>
          <option value="INSERT">INSERT (Добавить)</option>
          <option value="UPDATE">UPDATE (Изменить)</option>
          <option value="DELETE">DELETE (Удалить)</option>
          <option value="ALTER">ALTER (Изменить структуру)</option>
          <option value="CREATE">CREATE (Создать)</option>
          <option value="DROP">DROP (Удалить таблицу)</option>
        </select>
      </div>

      {/* ============================= */}
      {/* Поля с агрегатными функциями */}
      {/* ============================= */}
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
                setAggregateFunctions({
                  ...aggregateFunctions,
                  [field]: e.target.value,
                })
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
        <button onClick={() => setFields([...fields, ""])}>➕ Добавить поле</button>
      </div>

      {/* ============================= */}
      {/* Кнопка */}
      {/* ============================= */}
      <div className="action-group">
        <button onClick={handleGenerateSQL}>⚡ Выполнить / Сгенерировать SQL</button>
      </div>

      {/* ============================= */}
      {/* Вывод SQL */}
      {/* ============================= */}
      <div className="sql-output">
        <h3>🧾 Сгенерированный SQL:</h3>
        <pre>{generatedSQL}</pre>
      </div>
    </div>
  );
}
