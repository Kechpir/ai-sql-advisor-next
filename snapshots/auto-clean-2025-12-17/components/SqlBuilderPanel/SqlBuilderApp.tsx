import React, { useState } from "react";
import ConnectionManager from "./ConnectionManager";

export default function SqlBuilderApp() {
  const [schema, setSchema] = useState<any | null>(null);
  const [query, setQuery] = useState<string>("");
  const [result, setResult] = useState<any | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  /** 🔌 Обработка подключения */
  const handleConnected = (dbSchema: any) => {
    setSchema(dbSchema);
    console.log("✅ Connected, schema loaded:", dbSchema);
  };

  /** ⚙️ Выполнение SQL */
  const executeQuery = async () => {
    if (!schema) return setError("⚠️ Сначала подключитесь к базе данных");
    if (!query.trim()) return setError("⚠️ Введите SQL-запрос");

    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/fetch-query", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query }),
      });

      const data = await res.json();
      if (data.success) setResult(data.rows || []);
      else setError(data.error || "Ошибка выполнения SQL");
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="main-card">
      {/* === Подключение к базе === */}
      <ConnectionManager onConnected={handleConnected} />

      {/* === Если подключились === */}
      {schema && (
        <>
          <h3 style={{ color: "#22d3ee", marginTop: "2rem" }}>
            🧩 SQL Конструктор (Connected)
          </h3>

          <textarea
            placeholder="Введите SQL-запрос..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            style={{
              width: "100%",
              height: 150,
              background: "#0b1220",
              color: "#e5e7eb",
              border: "1px solid #1f2937",
              borderRadius: 12,
              padding: 10,
              marginTop: 10,
            }}
          />

          <div style={{ textAlign: "right", marginTop: "1rem" }}>
            <button
              className="btn btn-main"
              onClick={executeQuery}
              disabled={loading}
            >
              ⚡ {loading ? "Выполняется..." : "Выполнить SQL"}
            </button>
          </div>

          {error && (
            <div className="toast err" style={{ marginTop: 12 }}>
              {error}
            </div>
          )}

          {result && result.length > 0 && (
            <div className="result-card" style={{ marginTop: 20 }}>
              <div className="result-header">
                <span>📊 {result.length} строк</span>
                <button
                  className="copy-btn"
                  onClick={() =>
                    navigator.clipboard.writeText(JSON.stringify(result, null, 2))
                  }
                >
                  📋 Копировать JSON
                </button>
              </div>
              <pre>{JSON.stringify(result, null, 2)}</pre>
            </div>
          )}
        </>
      )}
    </div>
  );
}
