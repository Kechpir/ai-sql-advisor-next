import { useState, useEffect } from "react";
import Link from "next/link";
import { getLogs, LogEntry } from "@/lib/api";

interface FrequentQuery {
  sql: string;
  count: number;
}

export default function LogsPage() {
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [frequentQueries, setFrequentQueries] = useState<FrequentQuery[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [total, setTotal] = useState(0);
  const [offset, setOffset] = useState(0);
  const limit = 50;

  // Фильтры
  const [searchQuery, setSearchQuery] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");

  const loadLogs = async () => {
    setLoading(true);
    setError(null);
    try {
      // Загружаем все логи (sql_generation и sql_execution)
      // Не фильтруем по action_type, чтобы показать все действия пользователя
      const response = await getLogs({
        // action_type: undefined, // Показываем все типы логов
        limit,
        offset,
        search: searchQuery || undefined,
        start_date: startDate || undefined,
        end_date: endDate || undefined,
      });
      setLogs(response.logs);
      setTotal(response.total);
    } catch (e: any) {
      setError(e.message || "Ошибка загрузки логов");
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const loadFrequentQueries = async () => {
    try {
      const jwt = localStorage.getItem('jwt');
      if (!jwt) return;

      const response = await fetch('/api/get-frequent-queries?limit=10&days=30', {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${jwt}`,
        },
      });

      if (response.ok) {
        const data = await response.json();
        setFrequentQueries(data.queries || []);
      }
    } catch (e) {
      console.error('Ошибка загрузки частых запросов:', e);
    }
  };

  useEffect(() => {
    loadLogs();
    loadFrequentQueries();
  }, [offset]);

  // Задержка поиска (debounce) и обновление при изменении фильтров
  useEffect(() => {
    const timer = setTimeout(() => {
      if (offset === 0) {
        loadLogs();
      } else {
        setOffset(0);
      }
    }, 500);

    return () => clearTimeout(timer);
  }, [searchQuery, startDate, endDate]);

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleString("ru-RU", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const copyToClipboard = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      alert("SQL скопирован в буфер обмена");
    } catch (e) {
      console.error("Ошибка копирования:", e);
    }
  };

  return (
    <div
      style={{
        maxWidth: 1400,
        width: "100%",
        margin: "0 auto",
        padding: "40px 20px 100px",
        minHeight: "100vh",
      }}
    >
      {/* Заголовок */}
      <div style={{ marginBottom: "32px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div>
          <h1 style={{ margin: 0, marginBottom: "8px", color: "#22d3ee", fontSize: "32px" }}>
            📜 История SQL запросов
          </h1>
          <p style={{ margin: 0, color: "#9ca3af", fontSize: "14px" }}>
            История всех выполненных SQL запросов за последний месяц
          </p>
        </div>
        <Link
          href="/"
          style={{
            padding: "10px 20px",
            background: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
            color: "white",
            textDecoration: "none",
            borderRadius: "8px",
            fontWeight: 600,
            fontSize: "14px",
          }}
        >
          ← На главную
        </Link>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 400px", gap: "24px" }}>
        {/* Основной список запросов */}
        <div>
          {/* Фильтры */}
          <div
            style={{
              background: "rgba(15, 23, 42, 0.8)",
              border: "1px solid rgba(51, 65, 85, 0.5)",
              borderRadius: "12px",
              padding: "20px",
              marginBottom: "24px",
            }}
          >
            <div style={{ marginBottom: "16px" }}>
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="🔍 Поиск по SQL запросу..."
                style={{
                  width: "100%",
                  padding: "12px 16px",
                  background: "#0b1220",
                  border: "1px solid #334155",
                  borderRadius: "8px",
                  color: "#e5e7eb",
                  fontSize: "14px",
                }}
              />
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
              <div>
                <label style={{ display: "block", marginBottom: "8px", color: "#9ca3af", fontSize: "12px" }}>
                  От (дата начала)
                </label>
                <input
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  style={{
                    width: "100%",
                    padding: "10px 12px",
                    background: "#0b1220",
                    border: "1px solid #334155",
                    borderRadius: "8px",
                    color: "#e5e7eb",
                    fontSize: "14px",
                  }}
                />
              </div>
              <div>
                <label style={{ display: "block", marginBottom: "8px", color: "#9ca3af", fontSize: "12px" }}>
                  До (дата окончания)
                </label>
                <input
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  style={{
                    width: "100%",
                    padding: "10px 12px",
                    background: "#0b1220",
                    border: "1px solid #334155",
                    borderRadius: "8px",
                    color: "#e5e7eb",
                    fontSize: "14px",
                  }}
                />
              </div>
            </div>
            {(startDate || endDate) && (
              <button
                onClick={() => {
                  setStartDate("");
                  setEndDate("");
                }}
                style={{
                  marginTop: "12px",
                  padding: "6px 12px",
                  background: "rgba(239, 68, 68, 0.1)",
                  border: "1px solid rgba(239, 68, 68, 0.3)",
                  borderRadius: "6px",
                  color: "#fca5a5",
                  fontSize: "12px",
                  cursor: "pointer",
                }}
              >
                ✖ Сбросить фильтры по дате
              </button>
            )}
          </div>

          {/* Результаты */}
          {error && (
            <div
              style={{
                padding: "16px",
                background: "rgba(239, 68, 68, 0.1)",
                border: "1px solid rgba(239, 68, 68, 0.3)",
                borderRadius: "8px",
                color: "#fca5a5",
                marginBottom: "24px",
              }}
            >
              {error}
            </div>
          )}

          {loading && offset === 0 ? (
            <div style={{ textAlign: "center", padding: "40px", color: "#9ca3af" }}>Загрузка запросов...</div>
          ) : logs.length === 0 ? (
            <div style={{ textAlign: "center", padding: "40px", color: "#9ca3af" }}>Запросы не найдены</div>
          ) : (
            <>
              <div style={{ marginBottom: "16px", color: "#9ca3af", fontSize: "14px" }}>
                Найдено запросов: {total}
              </div>

              {/* Список запросов */}
              <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
                {logs.map((log) => (
                  <div
                    key={log.id}
                    style={{
                      background: log.success
                        ? "rgba(15, 23, 42, 0.8)"
                        : "rgba(239, 68, 68, 0.1)",
                      border: `1px solid ${log.success ? "rgba(51, 65, 85, 0.5)" : "rgba(239, 68, 68, 0.3)"}`,
                      borderRadius: "8px",
                      padding: "16px",
                    }}
                  >
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "12px" }}>
                      <div style={{ flex: 1 }}>
                        <div style={{ display: "flex", alignItems: "center", gap: "12px", marginBottom: "8px" }}>
                          {log.success ? (
                            <span style={{ color: "#10b981", fontSize: "14px" }}>✓ Успешно</span>
                          ) : (
                            <span style={{ color: "#ef4444", fontSize: "14px" }}>✗ Ошибка</span>
                          )}
                        </div>
                        <div style={{ color: "#9ca3af", fontSize: "12px" }}>{formatDate(log.created_at)}</div>
                      </div>
                      <div style={{ display: "flex", gap: "12px", fontSize: "12px", color: "#9ca3af" }}>
                        {log.execution_time_ms !== undefined && log.execution_time_ms !== null && (
                          <span>⏱️ {log.execution_time_ms} мс</span>
                        )}
                        {log.rows_returned !== undefined && log.rows_returned !== null && (
                          <span>📊 {log.rows_returned} строк</span>
                        )}
                      </div>
                    </div>

                    {/* SQL запрос */}
                    {log.sql_query && (
                      <div>
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "8px" }}>
                          <div style={{ color: "#9ca3af", fontSize: "12px" }}>SQL запрос:</div>
                          <button
                            onClick={() => copyToClipboard(log.sql_query || "")}
                            style={{
                              padding: "4px 8px",
                              background: "rgba(34, 211, 238, 0.1)",
                              border: "1px solid rgba(34, 211, 238, 0.3)",
                              borderRadius: "4px",
                              color: "#22d3ee",
                              fontSize: "12px",
                              cursor: "pointer",
                            }}
                          >
                            📋 Копировать
                          </button>
                        </div>
                        <div
                          style={{
                            padding: "12px",
                            background: "#0b1220",
                            borderRadius: "6px",
                            color: "#60a5fa",
                            fontSize: "13px",
                            fontFamily: "monospace",
                            whiteSpace: "pre-wrap",
                            wordBreak: "break-word",
                            maxHeight: "200px",
                            overflow: "auto",
                            border: "1px solid rgba(51, 65, 85, 0.5)",
                          }}
                        >
                          {log.sql_query}
                        </div>
                      </div>
                    )}

                    {/* Ошибка */}
                    {log.error_message && (
                      <div style={{ marginTop: "12px" }}>
                        <div style={{ color: "#ef4444", fontSize: "12px", marginBottom: "4px" }}>Ошибка:</div>
                        <div
                          style={{
                            padding: "8px",
                            background: "rgba(239, 68, 68, 0.1)",
                            borderRadius: "4px",
                            color: "#fca5a5",
                            fontSize: "13px",
                            fontFamily: "monospace",
                            whiteSpace: "pre-wrap",
                            wordBreak: "break-word",
                          }}
                        >
                          {log.error_message}
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>

              {/* Пагинация */}
              {total > limit && (
                <div style={{ display: "flex", justifyContent: "center", alignItems: "center", gap: "16px", marginTop: "32px" }}>
                  <button
                    onClick={() => setOffset(Math.max(0, offset - limit))}
                    disabled={offset === 0}
                    style={{
                      padding: "8px 16px",
                      background: offset === 0 ? "rgba(51, 65, 85, 0.3)" : "rgba(51, 65, 85, 0.8)",
                      border: "1px solid rgba(51, 65, 85, 0.5)",
                      borderRadius: "6px",
                      color: offset === 0 ? "#6b7280" : "#e5e7eb",
                      fontSize: "14px",
                      cursor: offset === 0 ? "not-allowed" : "pointer",
                    }}
                  >
                    ← Назад
                  </button>
                  <span style={{ color: "#9ca3af", fontSize: "14px" }}>
                    {offset + 1} - {Math.min(offset + limit, total)} из {total}
                  </span>
                  <button
                    onClick={() => setOffset(offset + limit)}
                    disabled={offset + limit >= total}
                    style={{
                      padding: "8px 16px",
                      background: offset + limit >= total ? "rgba(51, 65, 85, 0.3)" : "rgba(51, 65, 85, 0.8)",
                      border: "1px solid rgba(51, 65, 85, 0.5)",
                      borderRadius: "6px",
                      color: offset + limit >= total ? "#6b7280" : "#e5e7eb",
                      fontSize: "14px",
                      cursor: offset + limit >= total ? "not-allowed" : "pointer",
                    }}
                  >
                    Вперед →
                  </button>
                </div>
              )}
            </>
          )}
        </div>

        {/* Боковая панель - Частые запросы */}
        <div>
          <div
            style={{
              background: "rgba(15, 23, 42, 0.8)",
              border: "1px solid rgba(51, 65, 85, 0.5)",
              borderRadius: "12px",
              padding: "20px",
              position: "sticky",
              top: "20px",
            }}
          >
            <h2 style={{ margin: "0 0 16px", color: "#22d3ee", fontSize: "20px" }}>
              🔥 Частые запросы
            </h2>
            <p style={{ margin: "0 0 16px", color: "#9ca3af", fontSize: "12px" }}>
              Самые часто используемые SQL запросы за последние 30 дней
            </p>

            {frequentQueries.length === 0 ? (
              <div style={{ color: "#9ca3af", fontSize: "14px", textAlign: "center", padding: "20px" }}>
                Нет данных
              </div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
                {frequentQueries.map((query, index) => (
                  <div
                    key={index}
                    style={{
                      background: "#0b1220",
                      border: "1px solid rgba(51, 65, 85, 0.5)",
                      borderRadius: "8px",
                      padding: "12px",
                    }}
                  >
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "8px" }}>
                      <span style={{ color: "#22d3ee", fontSize: "14px", fontWeight: 600 }}>
                        #{index + 1}
                      </span>
                      <span style={{ color: "#9ca3af", fontSize: "12px" }}>
                        {query.count} {query.count === 1 ? "раз" : "раза"}
                      </span>
                    </div>
                    <div
                      style={{
                        color: "#60a5fa",
                        fontSize: "12px",
                        fontFamily: "monospace",
                        whiteSpace: "pre-wrap",
                        wordBreak: "break-word",
                        maxHeight: "150px",
                        overflow: "auto",
                        marginBottom: "8px",
                      }}
                    >
                      {query.sql}
                    </div>
                    <button
                      onClick={() => copyToClipboard(query.sql)}
                      style={{
                        width: "100%",
                        padding: "6px 12px",
                        background: "rgba(34, 211, 238, 0.1)",
                        border: "1px solid rgba(34, 211, 238, 0.3)",
                        borderRadius: "4px",
                        color: "#22d3ee",
                        fontSize: "12px",
                        cursor: "pointer",
                      }}
                    >
                      📋 Копировать
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
