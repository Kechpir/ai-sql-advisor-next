import React, { useState, useEffect } from "react";

interface Connection {
  name: string;
  host: string;
  port: string;
  database: string;
  user: string;
  password: string;
  dialect: string;
}

interface Props {
  onConnect?: (url: string) => void;
}

export default function ConnectionsPanel({ onConnect }: Props) {
  const [connections, setConnections] = useState<Connection[]>([]);
  const [newConn, setNewConn] = useState<Connection>({
    name: "",
    host: "",
    port: "5432",
    database: "",
    user: "",
    password: "",
    dialect: "postgres",
  });

  // Загружаем сохранённые соединения
  useEffect(() => {
    const saved = localStorage.getItem("savedConnections");
    if (saved) setConnections(JSON.parse(saved));
  }, []);

  const saveConnections = (list: Connection[]) => {
    localStorage.setItem("savedConnections", JSON.stringify(list));
    setConnections(list);
  };

  const handleAdd = () => {
    if (!newConn.name || !newConn.host || !newConn.database) return alert("❗ Заполни обязательные поля");
    const updated = [...connections, newConn];
    saveConnections(updated);
    setNewConn({
      name: "",
      host: "",
      port: "5432",
      database: "",
      user: "",
      password: "",
      dialect: "postgres",
    });
  };

  const handleDelete = (name: string) => {
    const filtered = connections.filter((c) => c.name !== name);
    saveConnections(filtered);
  };

  const connect = (conn: Connection) => {
    const url = `${conn.dialect}://${conn.user}:${conn.password}@${conn.host}:${conn.port}/${conn.database}`;
    onConnect?.(url);
  };

  return (
    <div className="main-card" style={{ marginTop: "1rem" }}>
      <h3 style={{ color: "#22d3ee" }}>🔗 Подключения к базам данных</h3>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem", marginTop: "1rem" }}>
        <input
          placeholder="Имя подключения"
          value={newConn.name}
          onChange={(e) => setNewConn({ ...newConn, name: e.target.value })}
        />
        <select
          value={newConn.dialect}
          onChange={(e) => setNewConn({ ...newConn, dialect: e.target.value })}
        >
          <option value="postgres">PostgreSQL</option>
          <option value="mysql">MySQL</option>
          <option value="mssql">MSSQL</option>
          <option value="oracle">Oracle</option>
          <option value="sqlite">SQLite</option>
        </select>

        <input
          placeholder="Хост"
          value={newConn.host}
          onChange={(e) => setNewConn({ ...newConn, host: e.target.value })}
        />
        <input
          placeholder="Порт"
          value={newConn.port}
          onChange={(e) => setNewConn({ ...newConn, port: e.target.value })}
        />

        <input
          placeholder="База данных"
          value={newConn.database}
          onChange={(e) => setNewConn({ ...newConn, database: e.target.value })}
        />
        <input
          placeholder="Пользователь"
          value={newConn.user}
          onChange={(e) => setNewConn({ ...newConn, user: e.target.value })}
        />

        <input
          type="password"
          placeholder="Пароль"
          value={newConn.password}
          onChange={(e) => setNewConn({ ...newConn, password: e.target.value })}
        />
        <button className="btn btn-main" onClick={handleAdd}>
          💾 Сохранить
        </button>
      </div>

      {connections.length > 0 && (
        <div style={{ marginTop: "1.5rem" }}>
          <h4 style={{ color: "#38bdf8" }}>Сохранённые подключения</h4>
          {connections.map((conn) => (
            <div
              key={conn.name}
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                border: "1px solid #1f2937",
                borderRadius: 10,
                padding: "0.6rem 1rem",
                marginTop: "0.6rem",
                background: "#0b1220",
              }}
            >
              <span>
                {conn.name} — {conn.dialect}@{conn.host}:{conn.port}/{conn.database}
              </span>
              <div style={{ display: "flex", gap: "0.5rem" }}>
                <button className="btn btn-sec" onClick={() => connect(conn)}>
                  🔌 Подключить
                </button>
                <button className="btn btn-sec" onClick={() => handleDelete(conn.name)}>
                  ❌ Удалить
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
