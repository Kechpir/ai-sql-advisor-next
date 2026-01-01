import React, { useState, useEffect } from "react";

interface Connection {
  name: string;
  host: string;
  port: string;
  database: string;
  user: string;
  password: string;
  dialect: string;
  connectionString?: string; // Для хранения полной строки подключения из Supabase
}

interface Props {
  onLoaded: (schema: any) => void;
  onToast: (type: "ok" | "warn" | "err", text: string) => void;
  onConnectionString?: (connectionString: string, dbType: string) => void;
}

export default function SimpleDbConnect({ onLoaded, onToast, onConnectionString }: Props) {
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

  // Загружаем сохранённые соединения из Supabase
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
              // Парсим connection string для отображения (без пароля)
              let parsed: any = {
                host: conn.host || '',
                port: '5432',
                database: conn.database || '',
                user: '',
                password: '', // Пароль не сохраняем для безопасности
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
                    password: '', // Пароль не извлекаем для безопасности
                    dialect: conn.dbType || 'postgres',
                  };
                }
              } catch {
                // Если не удалось распарсить, используем данные из БД
              }
              
              return {
                name: conn.name,
                ...parsed,
                connectionString: conn.connectionString, // Сохраняем connection string для прямого использования
              };
            });
            setConnections(formattedConnections);
          }
        }
      } catch (err) {
        console.error('Ошибка загрузки подключений:', err);
        // Не используем localStorage fallback (безопасность)
      }
    };

    loadConnections();
  }, []);

  const saveConnections = async (list: Connection[]) => {
    const jwt = localStorage.getItem('jwt');
    
    // НЕ сохраняем в localStorage (безопасность - пароли не должны храниться в браузере)
    setConnections(list);

    // Сохраняем только в Supabase (с шифрованием)
    if (!jwt) {
      console.warn('Попытка сохранить подключение без авторизации');
      return;
    }

    try {
      // Сохраняем каждое подключение
      for (const conn of list) {
        // Используем connection string из объекта, если есть, иначе формируем
        let connectionString = conn.connectionString || '';
        
        if (!connectionString) {
          // Формируем connection string
          const dialect = conn.dialect.toLowerCase();
          const port = conn.port || (dialect === "mysql" ? "3306" : dialect === "mssql" ? "1433" : "5432");
          const password = conn.password ? `:${encodeURIComponent(conn.password)}` : "";
          
          if (dialect === "postgres" || dialect === "postgresql") {
            connectionString = `postgresql://${conn.user}${password}@${conn.host}:${port}/${conn.database}?sslmode=require`;
          } else if (dialect === "mysql") {
            connectionString = `mysql://${conn.user}${password}@${conn.host}:${port}/${conn.database}`;
          } else if (dialect === "sqlite") {
            connectionString = `file:${conn.database}`;
          } else {
            connectionString = `postgresql://${conn.user}${password}@${conn.host}:${port}/${conn.database}?sslmode=require`;
          }
        }

        const res = await fetch('/api/save-connection', {
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

        if (!res.ok) {
          const error = await res.json().catch(() => ({ error: 'Unknown error' }));
          console.error(`Ошибка сохранения подключения ${conn.name}:`, error);
        }
      }
    } catch (err) {
      console.error('Ошибка сохранения подключений в Supabase:', err);
      // Игнорируем ошибку, так как уже сохранили в localStorage
    }
  };

  const handleAdd = async () => {
    if (!newConn.name || !newConn.host || !newConn.database) {
      onToast("warn", "❗ Заполни обязательные поля");
      return;
    }
    
    // Формируем connection string для сохранения
    let connectionString = '';
    const dialect = newConn.dialect.toLowerCase();
    const portValue = newConn.port || (dialect === "mysql" ? "3306" : dialect === "mssql" ? "1433" : "5432");
    const passwordEncoded = newConn.password ? `:${encodeURIComponent(newConn.password)}` : "";
    
    if (dialect === "postgres" || dialect === "postgresql") {
      connectionString = `postgresql://${newConn.user}${passwordEncoded}@${newConn.host}:${portValue}/${newConn.database}?sslmode=require`;
    } else if (dialect === "mysql") {
      connectionString = `mysql://${newConn.user}${passwordEncoded}@${newConn.host}:${portValue}/${newConn.database}`;
    } else if (dialect === "sqlite") {
      connectionString = `file:${newConn.database}`;
    } else {
      connectionString = `postgresql://${newConn.user}${passwordEncoded}@${newConn.host}:${portValue}/${newConn.database}?sslmode=require`;
    }
    
    // Сохраняем connection string в объекте подключения
    const connWithString = { ...newConn, connectionString };
    const updated = [...connections.filter((c) => c.name !== newConn.name), connWithString];
    
    await saveConnections(updated);
    
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

  const handleDelete = async (name: string) => {
    const filtered = connections.filter((c) => c.name !== name);
    saveConnections(filtered);
    
    // Удаляем из Supabase
    const jwt = localStorage.getItem('jwt');
    if (jwt) {
      try {
        await fetch(`/api/save-connection?name=${encodeURIComponent(name)}`, {
          method: 'DELETE',
          headers: {
            'Authorization': `Bearer ${jwt}`,
          },
        });
      } catch (err) {
        console.error('Ошибка удаления подключения из Supabase:', err);
      }
    }
    
    onToast("ok", `🗑 Удалено: ${name}`);
  };

  const connect = async (conn: Connection) => {
    // Определяем диалект
    const dialect = conn.dialect?.toLowerCase() || 'postgres';
    
    // Если есть сохраненный connection string, используем его напрямую
    let url = conn.connectionString || "";
    
    // Если connection string нет, формируем его из полей
    if (!url) {
      // Проверяем обязательные поля
      if (!conn.host || !conn.database || !conn.user) {
        onToast("warn", "❗ Заполни обязательные поля: Хост, База данных, Пользователь");
        return;
      }

      // Формируем правильную строку подключения в зависимости от диалекта
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
    }
    
    // НЕ логируем connection strings (безопасность)
    
    setLoading(true);
    try {
      // Получаем JWT токен для авторизации
      const jwt = localStorage.getItem('jwt');
      if (!jwt) {
        throw new Error("Необходима авторизация для подключения к базе данных");
      }
      
      const headers: HeadersInit = { 
        "Content-Type": "application/json",
        "Authorization": `Bearer ${jwt}`
      };
      
      // Генерируем уникальное имя подключения на основе host+database
      const connectionName = conn.name?.trim() || `${conn.host}_${conn.database}`.replace(/[^a-zA-Z0-9_]/g, '_');
      
      // Сначала сохраняем connection string в Supabase (автоматически)
      // Это необходимо для безопасности - проверки принадлежности
      const saveRes = await fetch("/api/save-connection", {
        method: "POST",
        headers,
        body: JSON.stringify({
          name: connectionName,
          connectionString: url,
        }),
      });
      
      // Проверяем результат сохранения
      let saveSuccess = false;
      if (saveRes.ok) {
        saveSuccess = true;
      } else {
        const saveErrorData = await saveRes.json().catch(() => ({ error: "Ошибка сохранения подключения" }));
        // Если подключение уже существует - это нормально (upsert обработает)
        if (saveRes.status === 409) {
          saveSuccess = true; // Upsert уже обработал
        } else {
          console.warn("[SimpleDbConnect] Предупреждение при сохранении подключения:", saveErrorData.error);
          // Продолжаем, возможно подключение уже сохранено
        }
      }
      
      // Небольшая задержка для гарантии, что данные записались в БД (Replication lag в Supabase)
      if (saveSuccess) {
        console.log("[SimpleDbConnect] Подключение сохранено, ожидание записи в БД...");
        await new Promise(resolve => setTimeout(resolve, 300)); // Увеличено до 300мс
      }
      
      // Теперь запрашиваем схему (connection string уже сохранен и принадлежит пользователю)
      const res = await fetch("/api/fetch-schema", {
        method: "POST",
        headers,
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
      // НЕ сохраняем connection string в localStorage (безопасность)
      // Только метаданные для отображения (без пароля)
      const lastConnectionMeta = {
        dbType: dialect,
        database: conn.database,
        host: conn.host,
        timestamp: Date.now(),
      };
      localStorage.setItem("lastConnectionMeta", JSON.stringify(lastConnectionMeta));
      
      // Передаем connectionString в родительский компонент
      if (onConnectionString) {
        onConnectionString(url, dialect);
      }
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
        <div style={{ display: "flex", gap: "0.5rem", alignItems: "center" }}>
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
            style={{ flex: 1 }}
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
          {selectedSaved && (
            <button
              onClick={() => {
                handleDelete(selectedSaved);
                setSelectedSaved("");
                setNewConn({
                  name: "",
                  host: "",
                  port: "5432",
                  database: "",
                  user: "",
                  password: "",
                  dialect: "postgres",
                });
              }}
              style={{
                padding: "6px 12px",
                background: "#ef444420",
                color: "#fecaca",
                border: "1px solid #ef444460",
                borderRadius: 8,
                cursor: "pointer",
                fontSize: 12,
                whiteSpace: "nowrap",
              }}
              title="Удалить выбранное подключение"
            >
              🗑 Удалить
            </button>
          )}
        </div>
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
