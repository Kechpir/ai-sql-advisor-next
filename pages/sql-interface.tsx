import { useState } from "react";

interface QueryResult {
  columns: string[];
  rows: any[][];
}

export default function SqlInterfacePage() {
  const [query, setQuery] = useState("");
  const [result, setResult] = useState<QueryResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const runQuery = async () => {
    setLoading(true);
    setError(null);

    try {
      // имитация SQL запроса (в реальности сюда подключаешь свой API)
      const fakeResponse: QueryResult = {
        columns: ["id", "name", "email", "created_at"],
        rows: [
          [1, "Иван", "ivan@example.com", "2024-10-01"],
          [2, "Мария", "maria@example.com", "2024-10-02"],
        ],
      };

      // мини-фильтр для dangerous SQL
      const dangerous = /\b(DROP|ALTER|DELETE|TRUNCATE|GRANT|REVOKE)\b/i.test(query);
      if (dangerous) {
        setError("⚠️ В запросе обнаружены потенциально опасные операции!");
        setResult(null);
      } else {
        setResult(fakeResponse);
      }
    } catch (err) {
      setError("Ошибка выполнения запроса");
      setResult(null);
    } finally {
      setLoading(false);
    }
  };

  const clearQuery = () => {
    setQuery("");
    setResult(null);
    setError(null);
  };

  return (
    <div style={container}>
      <h1 style={title}>🧩 SQL Interface</h1>
      <p style={subtitle}>
        Поддерживаются <b>SELECT</b>, <b>INSERT</b>, <b>UPDATE</b>, <b>DELETE</b>, <b>JOIN</b>, <b>GROUP BY</b>,
        <b> ORDER BY</b>, а также <b>BEGIN / COMMIT / ROLLBACK</b> для транзакций.
      </p>

      {/* SQL Input */}
      <textarea
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Введите SQL-запрос, например: SELECT name, COUNT(*) FROM users GROUP BY name;"
        rows={6}
        style={textarea}
      />

      <div style={buttonRow}>
        <button onClick={runQuery} style={btnPrimary} disabled={loading}>
          {loading ? "⏳ Выполнение..." : "▶️ Выполнить"}
        </button>
        <button onClick={clearQuery} style={btnSecondary}>
          Очистить
        </button>
      </div>

      {/* Error */}
      {error && <div style={errorBox}>{error}</div>}

      {/* Result */}
      {result && (
        <div style={tableWrapper}>
          <h3>Результаты:</h3>
          <table style={table}>
            <thead>
              <tr>
                {result.columns.map((col) => (
                  <th key={col} style={thStyle}>
                    {col}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {result.rows.map((row, i) => (
                <tr key={i}>
                  {row.map((cell, j) => (
                    <td key={j} style={tdStyle}>
                      {String(cell)}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

/* 🎨 STYLES */
const container: React.CSSProperties = {
  maxWidth: 900,
  margin: "0 auto",
  padding: "30px 20px 80px",
  color: "#E5E7EB",
  backgroundColor: "#0f172a",
  borderRadius: 16,
  border: "1px solid #1f2937",
};

const title: React.CSSProperties = {
  fontSize: 32,
  fontWeight: 700,
  marginBottom: 8,
  color: "#3b82f6",
};

const subtitle: React.CSSProperties = {
  opacity: 0.8,
  marginBottom: 20,
};

const textarea: React.CSSProperties = {
  width: "100%",
  background: "#0b1220",
  color: "#E5E7EB",
  border: "1px solid #1f2937",
  borderRadius: 12,
  padding: "12px 14px",
  fontSize: 14,
  fontFamily: "monospace",
  resize: "vertical",
};

const buttonRow: React.CSSProperties = {
  display: "flex",
  gap: 10,
  marginTop: 10,
};

const btnPrimary: React.CSSProperties = {
  background: "linear-gradient(90deg, #22d3ee, #3b82f6)",
  color: "#0b1220",
  border: "none",
  borderRadius: 12,
  padding: "10px 18px",
  fontWeight: 700,
  cursor: "pointer",
};

const btnSecondary: React.CSSProperties = {
  background: "#111827",
  color: "#E5E7EB",
  border: "1px solid #1f2937",
  borderRadius: 12,
  padding: "10px 18px",
  cursor: "pointer",
};

const errorBox: React.CSSProperties = {
  background: "#ef444420",
  border: "1px solid #ef444460",
  color: "#fecaca",
  borderRadius: 10,
  padding: "10px 12px",
  marginTop: 20,
  fontWeight: 600,
};

const tableWrapper: React.CSSProperties = {
  marginTop: 20,
  overflowX: "auto",
};

const table: React.CSSProperties = {
  width: "100%",
  borderCollapse: "collapse",
  background: "#0b1220",
};

const thStyle: React.CSSProperties = {
  borderBottom: "1px solid #1f2937",
  padding: "6px 10px",
  textAlign: "left" as const,
  color: "#60a5fa",
  fontWeight: 600,
};

const tdStyle: React.CSSProperties = {
  padding: "8px 10px",
  borderBottom: "1px solid #1f2937",
  fontSize: 14,
};
