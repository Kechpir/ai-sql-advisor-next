import React, { useState, useEffect } from "react";

interface Props {
  onLoaded: (schema: any) => void;
  onToast: (type: "ok" | "warn" | "err", text: string) => void;
}

interface SavedConnection {
  name: string;
  host: string;
  port: string;
  database: string;
  user: string;
  password: string;
  dialect: string;
}

export default function DbConnect({ onLoaded, onToast }: Props) {
  const [host, setHost] = useState("");
  const [port, setPort] = useState("5432");
  const [database, setDatabase] = useState("");
  const [user, setUser] = useState("");
  const [password, setPassword] = useState("");
  const [dialect, setDialect] = useState("");
  const [connName, setConnName] = useState("");
  const [savedConnections, setSavedConnections] = useState<SavedConnection[]>([]);
  const [loading, setLoading] = useState(false);

  const SUPABASE_FETCH_URL =
    "https://zaheofzxbfqabdxdmjtz.supabase.co/functions/v1/fetch_schema";

  useEffect(() => {
    const stored = localStorage.getItem("savedConnections");
    if (stored) setSavedConnections(JSON.parse(stored));
  }, []);

  const connect = async () => {
    if (!dialect || !host || !database || !user) {
      onToast("warn", "Заполни обязательные поля (Диалект, Host, Database, User)");
      return;
    }

    setLoading(true);
    const connectionUrl = `${dialect}://${user}:${password}@${host}:${port}/${database}?sslmode=require`;


    try {
      const res = await fetch(SUPABASE_FETCH_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ db_url: connectionUrl }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.reason || data.error);

      onLoaded(data);
      onToast("ok", `✅ Подключено к ${database}`);
    } catch (err: any) {
      console.error(err);
      onToast("err", err.message || "Ошибка подключения");
    } finally {
      setLoading(false);
    }
  };

  const saveConnection = () => {
    if (!connName.trim()) return onToast("warn", "Введите имя подключения");
    const newConn = { name: connName, host, port, database, user, password, dialect };
    const updated = [...savedConnections.filter((c) => c.name !== connName), newConn];
    setSavedConnections(updated);
    localStorage.setItem("savedConnections", JSON.stringify(updated));
    onToast("ok", `💾 Сохранено: ${connName}`);
    setConnName("");
  };

  const loadConnection = (c: SavedConnection) => {
    setHost(c.host);
    setPort(c.port);
    setDatabase(c.database);
    setUser(c.user);
    setPassword(c.password);
    setDialect(c.dialect);
    onToast("ok", `🔌 Загружено подключение: ${c.name}`);
  };

  const deleteConnection = (name: string) => {
    const updated = savedConnections.filter((c) => c.name !== name);
    setSavedConnections(updated);
    localStorage.setItem("savedConnections", JSON.stringify(updated));
    onToast("ok", `🗑 Удалено: ${name}`);
  };

  return (
    <div style={{ display: "grid", gap: 16 }}>
      {/* === Основная форма === */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 1fr",
          gap: "20px",
        }}
      >
        {/* Левая колонка */}
        <div style={{ display: "grid", gap: 8 }}>
          <label>Диалект</label>
          <select
            value={dialect}
            onChange={(e) => setDialect(e.target.value)}
            style={inputStyle}
          >
            <option value="">SQL-диалект</option>
            <option value="postgres">PostgreSQL</option>
            <option value="mysql">MySQL</option>
            <option value="sqlite">SQLite</option>
            <option value="sqlserver">SQL Server</option>
            <option value="oracle">Oracle</option>
            <option value="mariadb">MariaDB</option>
            <option value="snowflake">Snowflake</option>
            <option value="redshift">Redshift</option>
          </select>

          <label>Host</label>
          <input
            style={inputStyle}
            placeholder="например: db.neon.tech"
            value={host}
            onChange={(e) => setHost(e.target.value)}
          />

          <label>Port</label>
          <input
            style={inputStyle}
            value={port}
            onChange={(e) => setPort(e.target.value)}
          />
        </div>

        {/* Правая колонка */}
        <div style={{ display: "grid", gap: 8 }}>
          <label>Database</label>
          <input
            style={inputStyle}
            placeholder="например: demo_db"
            value={database}
            onChange={(e) => setDatabase(e.target.value)}
          />

          <label>User</label>
          <input
            style={inputStyle}
            placeholder="например: postgres"
            value={user}
            onChange={(e) => setUser(e.target.value)}
          />

          <label>Password</label>
          <input
            type="password"
            style={inputStyle}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </div>
      </div>

      {/* Кнопка подключения */}
      <button
        className="btn btn-main"
        style={{
          marginTop: 12,
          width: "220px",
          justifySelf: "center",
        }}
        onClick={connect}
        disabled={loading}
      >
        {loading ? "⏳ Подключаемся..." : "🔌 Подключиться"}
      </button>

      {/* === Сохранённые подключения === */}
      <div
        style={{
          borderTop: "1px solid #1f2937",
          paddingTop: 12,
          marginTop: 10,
        }}
      >
        <h4 style={{ color: "#22d3ee", marginBottom: 8 }}>💾 Сохранённые подключения</h4>

        {savedConnections.length === 0 && (
          <p style={{ opacity: 0.6, fontSize: 14 }}>Нет сохранённых подключений</p>
        )}

        {savedConnections.map((c) => (
          <div
            key={c.name}
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              padding: "6px 10px",
              background: "#0b1220",
              borderRadius: 8,
              marginBottom: 6,
            }}
          >
            <span style={{ color: "#e5e7eb" }}>{c.name}</span>
            <div style={{ display: "flex", gap: 8 }}>
              <button style={miniBtn} onClick={() => loadConnection(c)}>
                🔄 Загрузить
              </button>
              <button style={miniBtn} onClick={() => deleteConnection(c.name)}>
                🗑
              </button>
            </div>
          </div>
        ))}

        <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
          <input
            placeholder="Имя подключения"
            value={connName}
            onChange={(e) => setConnName(e.target.value)}
            style={{ ...inputStyle, flex: 1 }}
          />
          <button style={miniBtn} onClick={saveConnection}>
            💾 Сохранить
          </button>
        </div>
      </div>
    </div>
  );
}

const inputStyle = {
  background: "#0b1220",
  color: "#e5e7eb",
  border: "1px solid #1f2937",
  borderRadius: 8,
  padding: "8px 10px",
  fontSize: 14,
};

const miniBtn = {
  background: "#111827",
  color: "#e5e7eb",
  border: "1px solid #374151",
  borderRadius: 8,
  padding: "6px 10px",
  cursor: "pointer",
  fontSize: 13,
};
