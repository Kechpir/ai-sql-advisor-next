// components/SqlBuilderPanel/ConnectionManager.tsx
import React, { useState, useEffect } from "react";

const SUPABASE_FETCH_URL =
  "https://zaheofzxbfqabdxdmjtz.supabase.co/functions/v1/fetch_schema";

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
  onConnected: (schema: any) => void;
  onError?: (msg: string) => void;
}

export default function ConnectionManager({ onConnected, onError }: Props) {
  const [connections, setConnections] = useState<Connection[]>([]);
  const [selected, setSelected] = useState<string>("");
  const [conn, setConn] = useState<Connection>({
    name: "",
    host: "",
    port: "5432",
    database: "",
    user: "",
    password: "",
    dialect: "PostgreSQL",
  });
  const [loading, setLoading] = useState(false);

  // === Загрузка из Supabase (только для авторизованных пользователей) ===
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
            // Преобразуем формат из API в формат Connection
            const formattedConnections: Connection[] = data.connections.map((conn: any) => {
              let parsed: any = {
                host: conn.host || '',
                port: '5432',
                database: conn.database || '',
                user: '',
                password: '', // Пароль не извлекаем для безопасности
                dialect: conn.dbType || 'PostgreSQL',
              };
              
              try {
                if (conn.connectionString) {
                  const url = new URL(conn.connectionString);
                  parsed = {
                    host: url.hostname || conn.host || '',
                    port: url.port || '5432',
                    database: url.pathname.replace('/', '') || conn.database || '',
                    user: url.username || '',
                    password: '', // Пароль не извлекаем для безопасности
                    dialect: conn.dbType || 'PostgreSQL',
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
            setConnections(formattedConnections);
          }
        }
      } catch (err) {
        console.error('Ошибка загрузки подключений:', err);
        // НЕ используем localStorage fallback (безопасность)
      }
    };

    loadConnections();
  }, []);

  const saveConnections = async (list: Connection[]) => {
    setConnections(list);
    
    // Сохраняем только в Supabase (с шифрованием)
    const jwt = localStorage.getItem('jwt');
    if (!jwt) {
      console.warn('Попытка сохранить подключение без авторизации');
      return;
    }

    try {
      // Сохраняем каждое подключение
      for (const conn of list) {
        // Формируем connection string
        let connectionString = '';
        const dialect = conn.dialect.toLowerCase();
        const port = conn.port || (dialect.includes("mysql") ? "3306" : "5432");
        const password = conn.password ? `:${encodeURIComponent(conn.password)}` : "";
        
        if (dialect.includes("postgres")) {
          connectionString = `postgresql://${conn.user}${password}@${conn.host}:${port}/${conn.database}?sslmode=require`;
        } else if (dialect.includes("mysql")) {
          connectionString = `mysql://${conn.user}${password}@${conn.host}:${port}/${conn.database}`;
        } else if (dialect.includes("sqlite")) {
          connectionString = `file:${conn.database}`;
        } else {
          connectionString = `postgresql://${conn.user}${password}@${conn.host}:${port}/${conn.database}?sslmode=require`;
        }

        await fetch('/api/save-connection', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${jwt}`,
          },
          body: JSON.stringify({
            name: conn.name,
            connectionString: connectionString,
          }),
        });
      }
    } catch (err) {
      console.error('Ошибка сохранения подключений в Supabase:', err);
    }
  };

  const addConnection = () => {
    if (!conn.name.trim() || !conn.host.trim()) return;
    const updated = [...connections.filter((c) => c.name !== conn.name), conn];
    saveConnections(updated);
    setSelected(conn.name);
  };

  const deleteConnection = (name: string) => {
    const updated = connections.filter((c) => c.name !== name);
    saveConnections(updated);
    if (selected === name) setSelected("");
  };

  // === Формирование строки подключения ===
  const makeDbUrl = (c: Connection) => {
    if (c.dialect.toLowerCase().includes("postgres"))
      return `postgresql://${c.user}:${c.password}@${c.host}:${c.port}/${c.database}`;
    if (c.dialect.toLowerCase().includes("mysql"))
      return `mysql://${c.user}:${c.password}@${c.host}:${c.port}/${c.database}`;
    if (c.dialect.toLowerCase().includes("sqlite"))
      return `file:${c.database}`;
    return "";
  };

  // === Подключение к БД ===
  const connectDb = async () => {
    const jwt = localStorage.getItem('jwt');
    if (!jwt) {
      onError?.("Необходима авторизация для подключения к базе данных");
      return;
    }

    setLoading(true);
    try {
      const db_url = makeDbUrl(conn);
      
      // Используем локальный API вместо прямого вызова Supabase Edge Function
      const res = await fetch("/api/fetch-schema", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${jwt}`,
        },
        body: JSON.stringify({ connectionString: db_url }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || "Ошибка подключения");
      }

      // Преобразуем формат ответа
      const schemaData = {
        tables: data.schema || {},
        countTables: data.tables?.length || Object.keys(data.schema || {}).length,
      };

      onConnected(schemaData);
      addConnection();
    } catch (e: any) {
      onError?.(e.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="main-card">
      <h2 style={{ textAlign: "center", color: "#22d3ee", marginBottom: "1rem" }}>
        🧠 Подключение к базе данных
      </h2>

      {/* сохранённые подключения */}
      {connections.length > 0 && (
        <div style={{ marginBottom: "1.2rem" }}>
          <label>Сохранённые подключения:</label>
          <select
            className="input"
            value={selected}
            onChange={(e) => {
              const name = e.target.value;
              setSelected(name);
              const found = connections.find((c) => c.name === name);
              if (found) setConn(found);
            }}
          >
            <option value="">— выбрать —</option>
            {connections.map((c) => (
              <option key={c.name}>{c.name}</option>
            ))}
          </select>
          {selected && (
            <button
              className="btn-sec"
              style={{ marginTop: 6 }}
              onClick={() => deleteConnection(selected)}
            >
              ❌ Удалить подключение
            </button>
          )}
        </div>
      )}

      <div className="grid-2" style={{ gap: "1rem" }}>
        <div>
          <label>Хост</label>
          <input
            value={conn.host}
            onChange={(e) => setConn({ ...conn, host: e.target.value })}
            placeholder="example.supabase.co"
          />

          <label>Порт</label>
          <input
            value={conn.port}
            onChange={(e) => setConn({ ...conn, port: e.target.value })}
          />

          <label>База данных</label>
          <input
            value={conn.database}
            onChange={(e) => setConn({ ...conn, database: e.target.value })}
          />
        </div>

        <div>
          <label>Пользователь</label>
          <input
            value={conn.user}
            onChange={(e) => setConn({ ...conn, user: e.target.value })}
          />

          <label>Пароль</label>
          <input
            type="password"
            value={conn.password}
            onChange={(e) => setConn({ ...conn, password: e.target.value })}
          />

          <label>Диалект</label>
          <select
            value={conn.dialect}
            onChange={(e) => setConn({ ...conn, dialect: e.target.value })}
          >
            <option>PostgreSQL</option>
            <option>MySQL</option>
            <option>SQLite</option>
          </select>
        </div>
      </div>

      <div style={{ marginTop: "1.5rem", textAlign: "center" }}>
        <button
          className="btn-main"
          onClick={connectDb}
          disabled={loading}
        >
          {loading ? "⏳ Подключаемся..." : "🚀 Подключиться"}
        </button>
      </div>
    </div>
  );
}
