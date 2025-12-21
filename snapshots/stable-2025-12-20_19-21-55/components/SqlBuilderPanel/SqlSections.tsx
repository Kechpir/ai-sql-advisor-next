import React, { useState } from "react";

interface ConnectionManagerProps {
  onConnected: (schema: Record<string, string[]>, dialect: string) => void;
}

export default function ConnectionManager({ onConnected }: ConnectionManagerProps) {
  const [connection, setConnection] = useState({
    name: "",
    host: "",
    port: "5432",
    database: "",
    user: "",
    password: "",
    dialect: "PostgreSQL",
  });

  const [isConnected, setIsConnected] = useState(false);
  const [status, setStatus] = useState("");

  const fakeSchema = {
    users: ["id", "name", "email", "created_at"],
    orders: ["id", "user_id", "amount", "status"],
    products: ["id", "title", "price", "stock"],
  };

  const handleConnect = () => {
    setStatus("⏳ Подключение...");
    setTimeout(() => {
      setIsConnected(true);
      setStatus("✅ Подключено к базе данных!");
      onConnected(fakeSchema, connection.dialect);
    }, 1000);
  };

  const handleTransaction = (action: string) => {
    setStatus(`💾 Транзакция: ${action.toUpperCase()} выполнена`);
  };

  return (
    <div className="connections-panel">
      <h3 className="section-title">🔌 Подключение к базе данных</h3>

      <div className="sql-grid-2">
        <div className="input-group">
          <label>Имя подключения</label>
          <input
            placeholder="Например: work_db"
            value={connection.name}
            onChange={(e) => setConnection({ ...connection, name: e.target.value })}
          />

          <label>Хост</label>
          <input
            placeholder="Например: your-db-instance.supabase.co"
            value={connection.host}
            onChange={(e) => setConnection({ ...connection, host: e.target.value })}
          />

          <label>Порт</label>
          <input
            value={connection.port}
            onChange={(e) => setConnection({ ...connection, port: e.target.value })}
          />

          <label>База данных</label>
          <input
            placeholder="Например: neon_db"
            value={connection.database}
            onChange={(e) => setConnection({ ...connection, database: e.target.value })}
          />
        </div>

        <div className="input-group">
          <label>Пользователь</label>
          <input
            placeholder="Например: postgres"
            value={connection.user}
            onChange={(e) => setConnection({ ...connection, user: e.target.value })}
          />

          <label>Пароль</label>
          <input
            type="password"
            placeholder="••••••••"
            value={connection.password}
            onChange={(e) => setConnection({ ...connection, password: e.target.value })}
          />

          <label>Диалект</label>
          <select
            value={connection.dialect}
            onChange={(e) => setConnection({ ...connection, dialect: e.target.value })}
          >
            {["PostgreSQL", "MySQL", "SQLite", "MSSQL", "Oracle"].map((db) => (
              <option key={db}>{db}</option>
            ))}
          </select>

          <button className="action-btn connect mt-2" onClick={handleConnect}>
            🔗 Подключиться
          </button>

          {isConnected && (
            <div className="flex gap-2 mt-3">
              <button
                className="action-btn save"
                onClick={() => handleTransaction("BEGIN")}
              >
                ▶️ Begin
              </button>
              <button
                className="action-btn refresh"
                onClick={() => handleTransaction("COMMIT")}
              >
                💾 Commit
              </button>
              <button
                className="delete-btn"
                onClick={() => handleTransaction("ROLLBACK")}
              >
                ❌ Rollback
              </button>
            </div>
          )}
        </div>
      </div>

      {status && <p className="mt-3 text-sm text-cyan-400">{status}</p>}
    </div>
  );
}
