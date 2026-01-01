import React, { useState, useEffect } from "react";
import { detectDbType, parseConnectionString, formatConnectionString, SUPPORTED_DB_TYPES, getDbTypeInfo } from "@/lib/db/detectDbType";

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
                  // Используем утилиту для парсинга connection string
                  const parsedConn = parseConnectionString(conn.connectionString);
                  const dbInfo = detectDbType(conn.connectionString);
                  parsed = {
                    host: parsedConn.host || conn.host || '',
                    port: parsedConn.port || dbInfo?.defaultPort || '5432',
                    database: parsedConn.database || conn.database || '',
                    user: parsedConn.user || '',
                    password: '', // Пароль не извлекаем для безопасности
                    dialect: parsedConn.type || conn.dbType || dbInfo?.type || 'postgres',
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
          // Используем утилиту для форматирования connection string
          try {
            const dbInfo = getDbTypeInfo(conn.dialect);
            let port = conn.port || dbInfo?.defaultPort || "5432";
            
            // Для Supabase используем connection pooling (порт 6543)
            const isSupabase = conn.host.includes('supabase.co');
            if (isSupabase && (conn.dialect === "postgres" || conn.dialect === "postgresql")) {
              port = "6543";
            }
            
            connectionString = formatConnectionString(
              conn.dialect,
              conn.host,
              port,
              conn.database,
              conn.user,
              conn.password,
              isSupabase ? { pgbouncer: "true" } : undefined
            );
          } catch (error) {
            // Fallback на старый метод
            const dialect = conn.dialect.toLowerCase();
            let port = conn.port || (dialect === "mysql" ? "3306" : dialect === "mssql" ? "1433" : "5432");
            const password = conn.password ? `:${encodeURIComponent(conn.password)}` : "";
            const isSupabase = conn.host.includes('supabase.co');
            if (isSupabase && (dialect === "postgres" || dialect === "postgresql")) {
              port = "6543";
            }
            if (dialect === "postgres" || dialect === "postgresql") {
              const sslParam = isSupabase ? "pgbouncer=true" : "sslmode=require";
              connectionString = `postgresql://${conn.user}${password}@${conn.host}:${port}/${conn.database}?${sslParam}`;
            } else if (dialect === "mysql" || dialect === "mariadb") {
              connectionString = `mysql://${conn.user}${password}@${conn.host}:${port}/${conn.database}`;
            } else if (dialect === "sqlite") {
              connectionString = `file:${conn.database}`;
            } else {
              connectionString = `postgresql://${conn.user}${password}@${conn.host}:${port}/${conn.database}?sslmode=require`;
            }
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
    try {
      const dbInfo = getDbTypeInfo(newConn.dialect);
      let portValue = newConn.port || dbInfo?.defaultPort || "5432";
      
      // Используем порт, указанный пользователем
      // Для pooling (порт 6543) пользователь должен указать его вручную
      const isSupabase = newConn.host.includes('supabase.co');
      
      connectionString = formatConnectionString(
        newConn.dialect,
        newConn.host,
        portValue,
        newConn.database,
        newConn.user,
        newConn.password,
        // pgbouncer=true только если пользователь явно указал порт 6543
        portValue === "6543" && isSupabase ? { pgbouncer: "true" } : undefined
      );
    } catch (error) {
      // Fallback на старый метод
            const dialect = newConn.dialect.toLowerCase();
            let portValue = newConn.port || (dialect === "mysql" ? "3306" : dialect === "mssql" ? "1433" : "5432");
            const passwordEncoded = newConn.password ? `:${encodeURIComponent(newConn.password)}` : "";
            const isSupabase = newConn.host.includes('supabase.co');
            
            // Используем порт, указанный пользователем
            if (dialect === "postgres" || dialect === "postgresql") {
              // pgbouncer=true только если порт 6543, иначе sslmode=require
              const sslParam = (portValue === "6543" && isSupabase) ? "pgbouncer=true" : "sslmode=require";
              connectionString = `postgresql://${newConn.user}${passwordEncoded}@${newConn.host}:${portValue}/${newConn.database}?${sslParam}`;
            } else if (dialect === "mysql" || dialect === "mariadb") {
              connectionString = `mysql://${newConn.user}${passwordEncoded}@${newConn.host}:${portValue}/${newConn.database}`;
            } else if (dialect === "sqlite") {
              connectionString = `file:${newConn.database}`;
            } else {
              connectionString = `postgresql://${newConn.user}${passwordEncoded}@${newConn.host}:${portValue}/${newConn.database}?sslmode=require`;
            }
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
    let dialect = conn.dialect?.toLowerCase() || 'postgres';
    
    // Если есть сохраненный connection string, используем его напрямую
    let url = conn.connectionString || "";
    
    // НЕ исправляем Transaction pooler (порт 6543) - он правильный для serverless/Vercel
    // Transaction pooler работает извне и идеален для Next.js API routes
    // Если используется pooler.supabase.com или порт 6543 - оставляем как есть
    // Исправляем только старые Direct connection строки с db.*.supabase.co:5432, если они не работают
    if (url && url.includes('supabase.co') && url.includes(':6543')) {
      console.log('[SimpleDbConnect] Используем Transaction pooler (порт 6543) - правильный выбор для serverless');
      // Оставляем как есть - Transaction pooler работает извне
    }
    
    // Если connection string нет, формируем его из полей
    if (!url) {
      // Проверяем обязательные поля
      if (!conn.host || !conn.database || !conn.user) {
        onToast("warn", "❗ Заполни обязательные поля: Хост, База данных, Пользователь");
        return;
      }

      try {
        // Используем утилиту для форматирования connection string
        const dbInfo = getDbTypeInfo(conn.dialect);
        let port = conn.port || dbInfo?.defaultPort || "5432";
        
        // Для Supabase используем Transaction pooler (идеален для serverless/Vercel)
        // Transaction pooler использует порт 6543 или pooler.supabase.com хост
        const isSupabase = conn.host.includes('supabase.co') || conn.host.includes('pooler.supabase.com');
        
        // Если хост содержит pooler, используем Transaction pooler параметры
        const usePooler = isSupabase && (port === "6543" || conn.host.includes('pooler'));
        
        url = formatConnectionString(
          conn.dialect,
          conn.host,
          port,
          conn.database,
          conn.user,
          conn.password,
          // Transaction pooler для Supabase (serverless-friendly)
          usePooler ? { pgbouncer: "true", pool_mode: "transaction" } : undefined
        );
        
        // Обновляем диалект на основе сформированной строки
        const detected = detectDbType(url);
        if (detected) {
          dialect = detected.type;
        }
      } catch (error) {
        // Fallback на старый метод
        let port = conn.port || (dialect === "mysql" ? "3306" : dialect === "mssql" ? "1433" : "5432");
        const password = conn.password ? `:${encodeURIComponent(conn.password)}` : "";
        const isSupabase = conn.host.includes('supabase.co');
        if (isSupabase && (dialect === "postgres" || dialect === "postgresql")) {
          port = "6543";
        }
        if (dialect === "postgres" || dialect === "postgresql") {
          const sslParam = isSupabase ? "pgbouncer=true" : "sslmode=require";
          url = `postgresql://${conn.user}${password}@${conn.host}:${port}/${conn.database}?${sslParam}`;
        } else if (dialect === "mysql" || dialect === "mariadb") {
          url = `mysql://${conn.user}${password}@${conn.host}:${port}/${conn.database}`;
        } else if (dialect === "sqlite") {
          url = `file:${conn.database}`;
        } else if (dialect === "mssql") {
          url = `mssql://${conn.user}${password}@${conn.host}:${port}/${conn.database}`;
        } else {
          url = `postgresql://${conn.user}${password}@${conn.host}:${port}/${conn.database}?sslmode=require`;
        }
      }
    } else {
      // Автоматически определяем тип БД из connection string
      const detected = detectDbType(url);
      if (detected) {
        dialect = detected.type;
      }
      
      // НЕ меняем порт автоматически - используем тот, что указан пользователем
      // Если пользователь хочет использовать pooling, он должен указать порт 6543 вручную
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
      
      // Если сервер вернул исправленный connection string, обновляем сохраненное подключение
      if (data.correctedConnectionString && data.correctedConnectionString !== url) {
        console.log('[SimpleDbConnect] Получен исправленный connection string от сервера');
        onToast("ok", `✅ Подключение автоматически оптимизировано для ${data.provider || 'провайдера'}`);
        
        // Обновляем сохраненное подключение с исправленным connection string
        const updatedConn = { ...conn, connectionString: data.correctedConnectionString };
        const updatedConnections = connections.map(c => 
          c.name === conn.name ? updatedConn : c
        );
        setConnections(updatedConnections);
        
        // Сохраняем исправленный вариант в Supabase
        try {
          const saveRes = await fetch("/api/save-connection", {
            method: "POST",
            headers,
            body: JSON.stringify({
              name: conn.name,
              connectionString: data.correctedConnectionString,
            }),
          });
          if (saveRes.ok) {
            console.log('[SimpleDbConnect] Исправленный connection string сохранен');
          }
        } catch (saveError) {
          console.warn('[SimpleDbConnect] Не удалось сохранить исправленный connection string:', saveError);
        }
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
      let errorMessage = err.message || "Ошибка подключения";
      
      // Улучшенные сообщения об ошибках
      if (errorMessage.includes("ENOTFOUND") || errorMessage.includes("getaddrinfo")) {
        if (conn.host.includes('supabase.co')) {
          errorMessage = "❌ Не удалось найти хост Supabase. Проверьте:\n1. Правильность хоста в Supabase Dashboard\n2. Используйте Connection Pooling (порт 6543) вместо Direct connection\n3. Проверьте настройки сети";
        } else {
          errorMessage = `❌ Хост "${conn.host}" не найден. Проверьте правильность адреса и доступность сети.`;
        }
      } else if (errorMessage.includes("password") || errorMessage.includes("authentication")) {
        errorMessage = "❌ Ошибка аутентификации. Проверьте правильность пароля и имени пользователя.";
      } else if (errorMessage.includes("timeout") || errorMessage.includes("ECONNREFUSED")) {
        errorMessage = `❌ Не удалось подключиться к ${conn.host}. Проверьте:\n1. Правильность порта\n2. Доступность базы данных\n3. Настройки firewall`;
      }
      
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

      <div style={{ marginTop: "1rem", marginBottom: "1rem" }}>
        <label style={{ display: "block", marginBottom: "0.35rem", fontSize: "0.85rem", color: "#9ca3af" }}>
          💡 Или вставьте connection string (автоматическое определение и исправление)
        </label>
        <div style={{ fontSize: "0.75rem", color: "#6b7280", marginBottom: "0.5rem", padding: "0.5rem", background: "#1f293720", borderRadius: "6px" }}>
          <strong>Поддерживаемые провайдеры:</strong> Supabase, Neon, AWS RDS, Azure, GCP, Railway, Render и другие.<br/>
          Система автоматически определит тип БД и исправит connection string для оптимальной работы.
        </div>
        <input
          placeholder="postgresql://user:password@host:port/database"
          style={{ width: "100%", marginBottom: "0.5rem" }}
          onPaste={async (e) => {
            const pastedText = e.clipboardData.getData('text');
            if (pastedText && (pastedText.includes('://') || pastedText.startsWith('file:'))) {
              e.preventDefault();
              try {
                const parsed = parseConnectionString(pastedText);
                const dbInfo = detectDbType(pastedText);
                
                if (parsed.host || parsed.database) {
                  setNewConn({
                    name: newConn.name || dbInfo?.displayName || "Новое подключение",
                    host: parsed.host || "",
                    port: parsed.port || dbInfo?.defaultPort || "5432",
                    database: parsed.database || "",
                    user: parsed.user || "",
                    password: parsed.password || "",
                    dialect: parsed.type || dbInfo?.type || "postgres",
                    connectionString: pastedText,
                  });
                  onToast("ok", `✅ Автоматически определен тип: ${dbInfo?.displayName || "Неизвестно"}`);
                }
              } catch (error) {
                console.error("Ошибка парсинга connection string:", error);
              }
            }
          }}
        />
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem", marginTop: "1rem" }}>
        <input
          placeholder="Имя подключения"
          value={newConn.name}
          onChange={(e) => setNewConn({ ...newConn, name: e.target.value })}
        />
        <select
          value={newConn.dialect}
          onChange={(e) => {
            const selectedDialect = e.target.value;
            const dbInfo = getDbTypeInfo(selectedDialect);
            setNewConn({ 
              ...newConn, 
              dialect: selectedDialect,
              port: dbInfo?.defaultPort || newConn.port || "5432"
            });
          }}
        >
          {Object.values(SUPPORTED_DB_TYPES).map((dbInfo) => (
            <option key={dbInfo.type} value={dbInfo.type}>
              {dbInfo.displayName}
            </option>
          ))}
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
