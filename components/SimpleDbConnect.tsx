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
  onLoaded: (schema: any) => void;
  onToast: (type: "ok" | "warn" | "err", text: string) => void;
}

export default function SimpleDbConnect({ onLoaded, onToast }: Props) {
  const [connections, setConnections] = useState<Connection[]>([]);
  const [selectedSaved, setSelectedSaved] = useState<string>("");
  const [newConn, setNewConn] = useState<Connection>({
    name: "",
    host: "",
    port: "5432",
    database: "",
    user: "",
    password: "",
    dialect: "postgres",
  });
  const [loading, setLoading] = useState(false);

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
    if (!newConn.name || !newConn.host || !newConn.database) {
      onToast("warn", "❗ Заполни обязательные поля");
      return;
    }
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
    onToast("ok", `💾 Сохранено: ${newConn.name}`);
  };

  const handleDelete = (name: string) => {
    const filtered = connections.filter((c) => c.name !== name);
    saveConnections(filtered);
    onToast("ok", `🗑 Удалено: ${name}`);
  };

  const connect = async (conn: Connection) => {
    // Проверяем обязательные поля
    if (!conn.host || !conn.database || !conn.user) {
      onToast("warn", "❗ Заполни обязательные поля: Хост, База данных, Пользователь");
      return;
    }

    // Формируем правильную строку подключения в зависимости от диалекта
    let url = "";
    const dialect = conn.dialect.toLowerCase();
    const port = conn.port || (dialect === "mysql" ? "3306" : dialect === "mssql" ? "1433" : "5432");
    const password = conn.password ? `:${encodeURIComponent(conn.password)}` : "";
    
    if (dialect === "postgres" || dialect === "postgresql") {
      // Добавляем sslmode=require для безопасного подключения
      url = `postgresql://${conn.user}${password}@${conn.host}:${port}/${conn.database}?sslmode=require`;
    } else if (dialect === "mysql") {
      url = `mysql://${conn.user}${password}@${conn.host}:${port}/${conn.database}`;
    } else if (dialect === "sqlite") {
      url = `file:${conn.database}`;
    } else if (dialect === "mssql") {
      url = `mssql://${conn.user}${password}@${conn.host}:${port}/${conn.database}`;
    } else {
      url = `postgresql://${conn.user}${password}@${conn.host}:${port}/${conn.database}?sslmode=require`;
    }
    
    console.log("Подключение к БД:", { dialect, host: conn.host, database: conn.database, url: url.replace(/:[^:@]+@/, ":****@") });
    
    setLoading(true);
    try {
      const res = await fetch("/api/fetch-schema", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ connectionString: url }),
      });
      
      let data;
      const contentType = res.headers.get("content-type");
      
      // Проверяем, что ответ JSON
      if (!contentType || !contentType.includes("application/json")) {
        const text = await res.text();
        throw new Error(`Сервер вернул не JSON ответ (${res.status}): ${text.substring(0, 200)}`);
      }
      
      try {
        data = await res.json();
      } catch (parseError: any) {
        const text = await res.text();
        throw new Error(`Ошибка парсинга JSON ответа (${res.status}): ${parseError.message}. Ответ: ${text.substring(0, 200)}`);
      }
      
      if (!res.ok) {
        throw new Error(data?.error || data?.message || `HTTP ${res.status}: ${res.statusText}`);
      }
      
      if (!data.success) {
        throw new Error(data.error || data.message || "Ошибка загрузки схемы");
      }
      
      if (!data.schema) {
        throw new Error("Схема не получена от сервера");
      }
      
      // Преобразуем схему в формат, который ожидает главная страница
      const schemaData = {
        tables: data.schema || {},
        countTables: data.tables?.length || Object.keys(data.schema || {}).length,
      };
      
      onLoaded(schemaData);
      onToast("ok", `✅ Подключено к ${conn.database}`);
    } catch (err: any) {
      console.error("Ошибка подключения:", err);
      const errorMessage = err.message || "Ошибка подключения";
      onToast("err", errorMessage);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="main-card" style={{ marginTop: "1rem", marginBottom: "14px" }}>
      <h3 style={{ color: "#22d3ee" }}>🔗 Подключения к базам данных</h3>

      <div style={{ marginTop: "0.75rem", marginBottom: "0.75rem" }}>
        <label style={{ display: "block", marginBottom: "0.35rem", fontSize: "0.85rem", color: "#9ca3af" }}>
          Выбрать сохранённое подключение
        </label>
        <select
          value={selectedSaved}
          onChange={(e) => {
            const name = e.target.value;
            setSelectedSaved(name);
            const conn = connections.find((c) => c.name === name);
            if (conn) {
              setNewConn(conn);
              connect(conn);
            }
          }}
          disabled={connections.length === 0}
        >
          <option value="">
            {connections.length === 0 ? "нет сохранённых подключений" : "— не выбрано —"}
          </option>
          {connections.map((c) => (
            <option key={c.name} value={c.name}>
              {c.name} — {c.dialect}@{c.host}:{c.port}/{c.database}
            </option>
          ))}
        </select>
      </div>

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
        <div style={{ display: "flex", gap: "0.5rem" }}>
          <button className="btn btn-main" onClick={() => connect(newConn)} disabled={loading} style={{ flex: 1 }}>
            {loading ? "⏳..." : "🔌 Подключить"}
          </button>
          <button className="btn btn-sec" onClick={handleAdd} disabled={loading}>
            💾 Сохранить
          </button>
        </div>
      </div>
    </div>
  );
}
