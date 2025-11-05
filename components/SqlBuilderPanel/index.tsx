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

interface Database {
  name: string;
  connection: string;
  dbType: string;
}

export default function SqlBuilderPanel() {
  const [databases, setDatabases] = useState<Database[]>([]);
  const [selectedDb, setSelectedDb] = useState<string>("default");
  const [connectedDb, setConnectedDb] = useState<string | null>(null);
  const [showSaved, setShowSaved] = useState<boolean>(false);

  const [dbName, setDbName] = useState<string>("");
  const [connectionString, setConnectionString] = useState<string>("");
  const [dbType, setDbType] = useState<string>("postgres");

  const [queryType, setQueryType] = useState<string>("SELECT");
  const [table, setTable] = useState<string>("users");
  const [fields, setFields] = useState<string[]>(["id", "name", "email"]);
  const [joins, setJoins] = useState<SqlJoin[]>([]);
  const [filters, setFilters] = useState<SqlFilter[]>([]);
  const [orderBy, setOrderBy] = useState<SqlOrder[]>([]);
  const [transaction, setTransaction] = useState<boolean>(false);

  const [generatedSQL, setGeneratedSQL] = useState<string>("");
  const [queryResult, setQueryResult] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState<boolean>(false);

  // =============================
  // 🧩 Загрузка сохранённых БД
  // =============================
  useEffect(() => {
    const local = localStorage.getItem("savedDatabases");
    if (local) setDatabases(JSON.parse(local));
  }, []);

  // =============================
  // 💾 Добавить новую БД
  // =============================
  const handleAddDatabase = () => {
    if (!dbName || !connectionString.trim()) return alert("Введите имя и строку подключения!");
    const updated = [...databases, { name: dbName, connection: connectionString, dbType }];
    setDatabases(updated);
    localStorage.setItem("savedDatabases", JSON.stringify(updated));
    setDbName("");
    setConnectionString("");
    alert("✅ База добавлена в список");
  };

  // =============================
  // 🗑 Удалить подключение
  // =============================
  const handleDeleteDatabase = (index: number) => {
    const updated = databases.filter((_, i) => i !== index);
    setDatabases(updated);
    localStorage.setItem("savedDatabases", JSON.stringify(updated));
  };

  // =============================
  // 🔌 Подключение к базе
  // =============================
  const handleConnect = async () => {
    if (selectedDb === "default") {
      setConnectedDb(null);
      alert("Подключено к базе по умолчанию");
      return;
    }

    const db = databases.find((d) => d.connection === selectedDb);
    if (!db) return alert("База не найдена");

    try {
      setLoading(true);
      const res = await fetch("/api/connect-db", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ connectionString: db.connection }),
      });
      const result = await res.json();

      if (!res.ok) throw new Error(result.error);
      setConnectedDb(db.name);
      alert(`✅ Подключено к базе: ${db.name}`);
    } catch (err: any) {
      alert("❌ Ошибка подключения: " + err.message);
    } finally {
      setLoading(false);
    }
  };

  // =============================
  // 🔄 Загрузка схемы таблиц
  // =============================
  const handleLoadSchema = async () => {
    try {
      setLoading(true);
      const res = await fetch("/api/fetch-schema");
      const result = await res.json();
      if (!result.success) throw new Error(result.error);
      alert("✅ Схема успешно загружена!");
      console.log(result.schema);
    } catch (err: any) {
      alert("❌ Ошибка при загрузке схемы: " + err.message);
    } finally {
      setLoading(false);
    }
  };

  // =============================
  // ⚡ Генерация и выполнение SQL
  // =============================
  const handleGenerateSQL = async () => {
    setError(null);
    const cleanFields = fields.filter((f) => f.trim() !== "");
    const jsonQuery = {
      dbType,
      queryType,
      table,
      fields: cleanFields,
      joins,
      filters,
      orderBy,
      transaction,
    };

    const sql = jsonToSql(jsonQuery as any);
    setGeneratedSQL(sql);
    setLoading(true);

    try {
      const response = await fetch("/api/fetch-query", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(jsonQuery),
      });

      const result = await response.json();
      if (!response.ok) throw new Error(result.error);
      setQueryResult(result.data || []);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  // =============================
  // 🗑 Удаление поля
  // =============================
  const handleDeleteField = (index: number) => {
    const updated = [...fields];
    updated.splice(index, 1);
    setFields(updated);
  };

  // =============================
  // 🖥️ Рендер
  // =============================
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
            <button onClick={() => setShowSaved(!showSaved)}>📂 Сохранённые базы</button>
          </div>

          {showSaved && (
            <div className="saved-db-list">
              <h4>💾 Сохранённые подключения</h4>
              {databases.length === 0 && <p>Пока нет сохранённых баз</p>}
              {databases.map((db, i) => (
                <div key={i} className="saved-db-item">
                  <span>{db.name} ({db.dbType})</span>
                  <div>
                    <button onClick={() => setSelectedDb(db.connection)}>🔌</button>
                    <button onClick={() => handleDeleteDatabase(i)}>🗑</button>
                  </div>
                </div>
              ))}
            </div>
          )}

          {selectedDb === "new" && (
            <div className="db-add-block">
              <div className="input-group small">
                <label>Имя подключения:</label>
                <input value={dbName} onChange={(e) => setDbName(e.target.value)} />
              </div>

              <div className="input-group small">
                <label>Connection String:</label>
                <input value={connectionString} onChange={(e) => setConnectionString(e.target.value)} />
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

          <button className="connect-btn" onClick={handleConnect} disabled={loading}>
            {connectedDb ? `🔗 Подключено: ${connectedDb}` : "🔌 Подключиться"}
          </button>

          <button className="schema-btn" onClick={handleLoadSchema} disabled={loading}>
            🔄 Загрузить схему
          </button>

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
            <input value={table} onChange={(e) => setTable(e.target.value)} placeholder="users" />
          </div>

          <div className="input-group small">
            <label>Поля:</label>
            {fields.map((field, i) => (
              <div key={i} className="field-row">
                <input
                  type="text"
                  value={field}
                  onChange={(e) => {
                    const updated = [...fields];
                    updated[i] = e.target.value;
                    setFields(updated);
                  }}
                />
                <button type="button" className="delete-field-btn" onClick={() => handleDeleteField(i)}>
                  🗑
                </button>
              </div>
            ))}
            <button className="add-btn" onClick={() => setFields([...fields, ""])}>
              ➕ Добавить поле
            </button>
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
        </div>
      </div>

      <div className="action-group">
        <button onClick={handleGenerateSQL} disabled={loading}>
          {loading ? "⏳ Выполняется..." : "⚡ Выполнить SQL"}
        </button>
      </div>

      <div className="sql-output">
        <h3>🧾 Сгенерированный SQL:</h3>
        <pre>{generatedSQL}</pre>
      </div>

      {error && <p className="error-text">❌ {error}</p>}
      {queryResult && (
        <div className="query-result">
          <h3>📊 Результат:</h3>
          <pre>{JSON.stringify(queryResult, null, 2)}</pre>
        </div>
      )}
    </div>
  );
}
