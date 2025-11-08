import React, { useState, useEffect } from "react";

interface ConnectionManagerProps {
  selectedDb: string;
  setSelectedDb: (db: string) => void;
  dbType: string;
  setDbType: (type: string) => void;
}

export default function ConnectionManager({
  selectedDb,
  setSelectedDb,
  dbType,
  setDbType,
}: ConnectionManagerProps) {
  const [databases, setDatabases] = useState<{ connection: string; dbType: string }[]>([]);
  const [connectionString, setConnectionString] = useState<string>("");

  // Загружаем сохранённые подключения при загрузке
  useEffect(() => {
    const saved = localStorage.getItem("savedDatabases");
    if (saved) setDatabases(JSON.parse(saved));
  }, []);

  // Сохраняем новое подключение
  const handleAddDatabase = () => {
    if (!connectionString.trim()) {
      alert("Введите строку подключения!");
      return;
    }

    const updated = [...databases, { connection: connectionString.trim(), dbType }];
    setDatabases(updated);
    localStorage.setItem("savedDatabases", JSON.stringify(updated));
    setConnectionString("");
    setSelectedDb(connectionString.trim());
  };

  return (
    <div className="input-group connection-manager">
      <label>Выбор базы данных:</label>
      <select
        value={selectedDb}
        onChange={(e) => setSelectedDb(e.target.value)}
        className="db-select"
      >
        <option value="default">🔘 Текущая (по умолчанию)</option>
        {databases.map((db, i) => (
          <option key={i} value={db.connection}>
            {db.connection.length > 60 ? db.connection.slice(0, 60) + "..." : db.connection}
          </option>
        ))}
        <option value="new">➕ Подключить новую</option>
      </select>

      {selectedDb === "new" && (
        <>
          <div className="connection-string-group">
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

          <button className="btn-save-db" onClick={handleAddDatabase}>
            ✅ Сохранить подключение
          </button>
        </>
      )}
    </div>
  );
}
