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
  const [mode, setMode] = useState<"form" | "url">("url"); // режим: форма или прямой URL
  const [url, setUrl] = useState(""); // прямой URL подключения
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
    const loadConnections = async () => {
      const jwt = localStorage.getItem('jwt');
      if (!jwt) {
        // Без авторизации подключения не загружаются (безопасность)
        return;
      }

      try {
        const res = await fetch('/api/save-connection', {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${jwt}`,
          },
        });

        if (res.ok) {
          const data = await res.json();
          if (data.success && data.connections) {
            // Преобразуем формат из API в формат SavedConnection
            const formattedConnections: SavedConnection[] = data.connections.map((conn: any) => {
              let parsed: any = {
                host: conn.host || '',
                port: '5432',
                database: conn.database || '',
                user: '',
                password: '',
                dialect: conn.dbType || 'postgres',
              };
              
              try {
                if (conn.connectionString) {
                  const url = new URL(conn.connectionString);
                  parsed = {
                    host: url.hostname || conn.host || '',
                    port: url.port || '5432',
                    database: url.pathname.replace('/', '') || conn.database || '',
                    user: url.username || '',
                    password: '',
                    dialect: conn.dbType || 'postgres',
                  };
                }
              } catch {
                // Если не удалось распарсить, используем данные из БД
              }
              
              return {
                name: conn.name,
                ...parsed,
              };
            });
            setSavedConnections(formattedConnections);
          }
        }
      } catch (err) {
        console.error('Ошибка загрузки подключений:', err);
        // НЕ используем localStorage fallback (безопасность)
      }
    };

    loadConnections();
  }, []);

  // Подключение через прямой URL
  const connectByUrl = async () => {
    if (!url.trim()) {
      onToast("warn", "Введите URL подключения");
      return;
    }

    setLoading(true);
    try {
      const res = await fetch(SUPABASE_FETCH_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ db_url: url.trim() }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.reason || data.error || "Ошибка загрузки схемы");
      }

      onLoaded(data);
      onToast("ok", "Схема успешно загружена ✅");
    } catch (err: any) {
      console.error(err);
      onToast("err", err.message || "Ошибка сети");
    } finally {
      setLoading(false);
    }
  };

  // Подключение через форму
  const connectByForm = async () => {
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
      if (!res.ok) {
        throw new Error(data.reason || data.error || "Ошибка загрузки схемы");
      }

      onLoaded(data);
      onToast("ok", `✅ Подключено к ${database}`);
    } catch (err: any) {
      console.error(err);
      onToast("err", err.message || "Ошибка подключения");
    } finally {
      setLoading(false);
    }
  };

  const saveConnection = async () => {
    if (!connName.trim()) return onToast("warn", "Введите имя подключения");
    
    let connectionString = '';
    let newConn: SavedConnection;
    
    // Если режим URL и есть URL, используем его напрямую
    if (mode === "url" && url.trim()) {
      connectionString = url.trim();
      try {
        // Парсим URL для сохранения в структурированном виде
        const urlObj = new URL(url.trim());
        newConn = {
          name: connName,
          dialect: urlObj.protocol.replace(":", ""),
          host: urlObj.hostname,
          port: urlObj.port || "5432",
          database: urlObj.pathname.replace("/", ""),
          user: urlObj.username,
          password: urlObj.password,
        };
      } catch (e) {
        onToast("warn", "Не удалось распарсить URL. Сохраните через форму.");
        return;
      }
    } else {
      // Сохранение из формы
      if (!dialect || !host || !database || !user) {
        onToast("warn", "Заполни обязательные поля (Диалект, Host, Database, User)");
        return;
      }
      
      // Формируем connection string
      const portValue = port || (dialect === "mysql" ? "3306" : dialect === "mssql" ? "1433" : "5432");
      const passwordEncoded = password ? `:${encodeURIComponent(password)}` : "";
      
      if (dialect === "postgres" || dialect === "postgresql") {
        connectionString = `postgresql://${user}${passwordEncoded}@${host}:${portValue}/${database}?sslmode=require`;
      } else if (dialect === "mysql") {
        connectionString = `mysql://${user}${passwordEncoded}@${host}:${portValue}/${database}`;
      } else if (dialect === "sqlite") {
        connectionString = `file:${database}`;
      } else {
        connectionString = `postgresql://${user}${passwordEncoded}@${host}:${portValue}/${database}?sslmode=require`;
      }
      
      newConn = { name: connName, host, port, database, user, password, dialect };
    }
    
    const updated = [...savedConnections.filter((c) => c.name !== connName), newConn];
    setSavedConnections(updated);
    
    // НЕ сохраняем в localStorage (безопасность - пароли не должны храниться в браузере)
    // Сохраняем только в Supabase (с шифрованием)
    const jwt = localStorage.getItem('jwt');
    if (!jwt) {
      onToast("warn", "Необходима авторизация для сохранения подключения");
      return;
    }
    
    try {
      try {
        await fetch('/api/save-connection', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${jwt}`,
          },
          body: JSON.stringify({
            name: connName,
            connectionString: connectionString,
          }),
        });
        
        if (!res.ok) {
          throw new Error('Ошибка сохранения подключения');
        }
      } catch (err) {
        console.error('Ошибка сохранения подключения в Supabase:', err);
        onToast("err", "Не удалось сохранить подключение");
        return;
      }
    
    onToast("ok", `💾 Сохранено: ${connName}`);
    setConnName("");
  };

  const loadConnection = (c: SavedConnection) => {
    // Загружаем в форму
    setHost(c.host);
    setPort(c.port);
    setDatabase(c.database);
    setUser(c.user);
    setPassword(c.password);
    setDialect(c.dialect);
    
    // Также формируем URL для режима прямого URL
    const connectionUrl = `${c.dialect}://${c.user}:${c.password}@${c.host}:${c.port}/${c.database}?sslmode=require`;
    setUrl(connectionUrl);
    
    onToast("ok", `🔌 Загружено подключение: ${c.name}`);
  };

  const deleteConnection = async (name: string) => {
    const updated = savedConnections.filter((c) => c.name !== name);
    setSavedConnections(updated);
    
    // НЕ сохраняем в localStorage (безопасность)
    // Удаляем только из Supabase
    const jwt = localStorage.getItem('jwt');
    if (!jwt) {
      onToast("warn", "Необходима авторизация для удаления подключения");
      return;
    }
    
    try {
      const res = await fetch(`/api/save-connection?name=${encodeURIComponent(name)}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${jwt}`,
        },
      });
      
      if (!res.ok) {
        throw new Error('Ошибка удаления подключения');
      }
    } catch (err) {
      console.error('Ошибка удаления подключения из Supabase:', err);
      onToast("err", "Не удалось удалить подключение");
      return;
    }
    
    onToast("ok", `🗑 Удалено: ${name}`);
  };

  return (
    <div style={{ display: "grid", gap: 16 }}>
      {/* === Переключатель режимов === */}
      <div style={{ display: "flex", gap: 8, marginBottom: 8 }}>
        <button
          onClick={() => setMode("url")}
          style={{
            ...miniBtn,
            background: mode === "url" ? "#111827" : "#0b1220",
            borderColor: mode === "url" ? "#3b82f6" : "#1f2937",
          }}
        >
          🔗 Прямой URL
        </button>
        <button
          onClick={() => setMode("form")}
          style={{
            ...miniBtn,
            background: mode === "form" ? "#111827" : "#0b1220",
            borderColor: mode === "form" ? "#3b82f6" : "#1f2937",
          }}
        >
          📝 Форма подключения
        </button>
      </div>

      {/* === Режим прямого URL === */}
      {mode === "url" && (
        <div style={{ display: "flex", gap: 8, alignItems: "flex-start" }}>
          <input
            placeholder="postgres://user:pass@host:port/db"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            style={{
              ...inputStyle,
              flex: 1,
            }}
            onKeyPress={(e) => {
              if (e.key === "Enter") connectByUrl();
            }}
          />
          <button
            className="btn btn-main"
            onClick={connectByUrl}
            disabled={loading}
            style={{ whiteSpace: "nowrap" }}
          >
            {loading ? "⏳..." : "🔌 Подключиться"}
          </button>
        </div>
      )}

      {/* === Режим формы === */}
      {mode === "form" && (
        <>
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
            onClick={connectByForm}
            disabled={loading}
          >
            {loading ? "⏳ Подключаемся..." : "🔌 Подключиться"}
          </button>
        </>
      )}

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

        {savedConnections.map((c) => {
          const connectionUrl = `${c.dialect}://${c.user}:${c.password}@${c.host}:${c.port}/${c.database}?sslmode=require`;
          return (
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
                <button
                  style={miniBtn}
                  onClick={() => {
                    setUrl(connectionUrl);
                    connectByUrl();
                  }}
                  disabled={loading}
                >
                  🔌 Подключить
                </button>
                <button style={miniBtn} onClick={() => loadConnection(c)}>
                  🔄 Загрузить
                </button>
                <button style={miniBtn} onClick={() => deleteConnection(c.name)}>
                  🗑
                </button>
              </div>
            </div>
          );
        })}

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
