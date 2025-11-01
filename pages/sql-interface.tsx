import { useEffect, useState } from "react";
import Image from "next/image";

type TableSchema = {
  name: string;
  columns: string[];
};

type QueryResult = {
  columns: string[];
  rows: any[];
};

export default function SqlInterface() {
  const [tables, setTables] = useState<TableSchema[]>([]);
  const [selectedTable, setSelectedTable] = useState<string>("");
  const [selectedColumns, setSelectedColumns] = useState<string[]>([]);
  const [filters, setFilters] = useState<{ column: string; op: string; value: string }[]>([]);
  const [aggregates, setAggregates] = useState<{ func: string; column: string }[]>([]);
  const [joins, setJoins] = useState<{ table: string; columnA: string; columnB: string }[]>([]);
  const [query, setQuery] = useState("");
  const [result, setResult] = useState<QueryResult | null>(null);
  const [history, setHistory] = useState<string[]>([]);
  const [isTransaction, setIsTransaction] = useState(false);
  const [loading, setLoading] = useState(false);

  // Mock data для MVP (потом заменим API-соединением)
  useEffect(() => {
    setTables([
      { name: "users", columns: ["id", "name", "email", "created_at"] },
      { name: "orders", columns: ["id", "user_id", "amount", "created_at"] },
      { name: "products", columns: ["id", "title", "price", "stock"] },
    ]);
  }, []);

  const buildQuery = () => {
    if (!selectedTable) return "";

    const cols = selectedColumns.length ? selectedColumns.join(", ") : "*";
    let sql = `SELECT ${cols} FROM ${selectedTable}`;

    joins.forEach((j) => {
      sql += ` JOIN ${j.table} ON ${selectedTable}.${j.columnA} = ${j.table}.${j.columnB}`;
    });

    if (filters.length) {
      const conds = filters.map((f) => `${f.column} ${f.op} '${f.value}'`).join(" AND ");
      sql += ` WHERE ${conds}`;
    }

    if (aggregates.length) {
      const aggs = aggregates.map((a) => `${a.func}(${a.column}) AS ${a.func}_${a.column}`);
      sql = `SELECT ${aggs.join(", ")} FROM ${selectedTable}`;
    }

    return sql + ";";
  };

  const handleExecute = async () => {
    setLoading(true);
    const sql = buildQuery() || query;
    try {
      // MOCK — потом заменим fetch("/api/run-sql")
      const mockResult: QueryResult = {
        columns: ["id", "name", "email"],
        rows: [
          [1, "Alice", "alice@example.com"],
          [2, "Bob", "bob@example.com"],
        ],
      };
      setResult(mockResult);
      setHistory((prev) => [sql, ...prev]);
    } finally {
      setLoading(false);
    }
  };

  const startTransaction = () => {
    setIsTransaction(true);
    setHistory((prev) => ["BEGIN TRANSACTION;", ...prev]);
  };

  const commitTransaction = () => {
    setIsTransaction(false);
    setHistory((prev) => ["COMMIT;", ...prev]);
  };

  const rollbackTransaction = () => {
    setIsTransaction(false);
    setHistory((prev) => ["ROLLBACK;", ...prev]);
  };

  return (
    <div style={{ padding: 24, color: "#e5e7eb", maxWidth: 1100, margin: "0 auto" }}>
      <header style={{ display: "flex", alignItems: "center", gap: 16, marginBottom: 20 }}>
        <Image src="/logo.png" alt="Logo" width={50} height={50} />
        <h1 style={{ fontSize: 24, fontWeight: 700 }}>SQL Interface</h1>
      </header>

      {/* ---------- TABLE SELECT ---------- */}
      <div
        style={{
          background: "#0f172a",
          padding: 16,
          borderRadius: 12,
          border: "1px solid #1f2937",
          marginBottom: 16,
        }}
      >
        <h2>📋 Таблицы</h2>
        <select
          style={selectStyle}
          value={selectedTable}
          onChange={(e) => {
            setSelectedTable(e.target.value);
            setSelectedColumns([]);
          }}
        >
          <option value="">Выберите таблицу...</option>
          {tables.map((t) => (
            <option key={t.name} value={t.name}>
              {t.name}
            </option>
          ))}
        </select>

        {selectedTable && (
          <>
            <h3>Столбцы:</h3>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 10 }}>
              {tables
                .find((t) => t.name === selectedTable)
                ?.columns.map((col) => (
                  <label key={col} style={labelBox}>
                    <input
                      type="checkbox"
                      checked={selectedColumns.includes(col)}
                      onChange={() =>
                        setSelectedColumns((prev) =>
                          prev.includes(col)
                            ? prev.filter((c) => c !== col)
                            : [...prev, col]
                        )
                      }
                    />
                    {col}
                  </label>
                ))}
            </div>
          </>
        )}
      </div>

      {/* ---------- FILTERS / AGGREGATES ---------- */}
      {selectedTable && (
        <div
          style={{
            background: "#0f172a",
            padding: 16,
            borderRadius: 12,
            border: "1px solid #1f2937",
            marginBottom: 16,
          }}
        >
          <h2>⚙️ Фильтры и агрегаты</h2>

          {/* Filters */}
          {filters.map((f, i) => (
            <div key={i} style={{ display: "flex", gap: 6, marginBottom: 8 }}>
              <select
                style={selectStyle}
                value={f.column}
                onChange={(e) =>
                  setFilters((p) => p.map((x, j) => (i === j ? { ...x, column: e.target.value } : x)))
                }
              >
                <option>Колонка</option>
                {tables
                  .find((t) => t.name === selectedTable)
                  ?.columns.map((c) => (
                    <option key={c}>{c}</option>
                  ))}
              </select>
              <select
                style={selectStyle}
                value={f.op}
                onChange={(e) =>
                  setFilters((p) => p.map((x, j) => (i === j ? { ...x, op: e.target.value } : x)))
                }
              >
                <option>=</option>
                <option>&gt;</option>
                <option>&lt;</option>
                <option>LIKE</option>
              </select>
              <input
                placeholder="значение"
                style={inputStyle}
                value={f.value}
                onChange={(e) =>
                  setFilters((p) => p.map((x, j) => (i === j ? { ...x, value: e.target.value } : x)))
                }
              />
            </div>
          ))}
          <button style={btnSec} onClick={() => setFilters([...filters, { column: "", op: "=", value: "" }])}>
            ➕ Добавить фильтр
          </button>

          <hr style={{ margin: "20px 0", borderColor: "#1f2937" }} />

          {/* Aggregates */}
          <h3>Агрегаты:</h3>
          {aggregates.map((a, i) => (
            <div key={i} style={{ display: "flex", gap: 6, marginBottom: 8 }}>
              <select
                style={selectStyle}
                value={a.func}
                onChange={(e) =>
                  setAggregates((p) => p.map((x, j) => (i === j ? { ...x, func: e.target.value } : x)))
                }
              >
                <option value="">Функция</option>
                <option>COUNT</option>
                <option>SUM</option>
                <option>AVG</option>
                <option>MIN</option>
                <option>MAX</option>
              </select>
              <select
                style={selectStyle}
                value={a.column}
                onChange={(e) =>
                  setAggregates((p) => p.map((x, j) => (i === j ? { ...x, column: e.target.value } : x)))
                }
              >
                <option value="">Колонка</option>
                {tables
                  .find((t) => t.name === selectedTable)
                  ?.columns.map((c) => (
                    <option key={c}>{c}</option>
                  ))}
              </select>
            </div>
          ))}
          <button style={btnSec} onClick={() => setAggregates([...aggregates, { func: "", column: "" }])}>
            ➕ Добавить агрегат
          </button>
        </div>
      )}

      {/* ---------- SQL Editor ---------- */}
      <div
        style={{
          background: "#0f172a",
          padding: 16,
          borderRadius: 12,
          border: "1px solid #1f2937",
          marginBottom: 16,
        }}
      >
        <h2>🧠 SQL запрос</h2>
        <textarea
          rows={6}
          value={query || buildQuery()}
          onChange={(e) => setQuery(e.target.value)}
          style={{ ...inputStyle, width: "100%" }}
        />
        <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
          <button style={btnMain} onClick={handleExecute} disabled={loading}>
            {loading ? "⏳ Выполняется..." : "▶ Выполнить"}
          </button>
          <button style={btnSec} onClick={() => setQuery("")}>
            🧹 Очистить
          </button>
        </div>
      </div>

      {/* ---------- TRANSACTIONS ---------- */}
      <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
        <button style={btnSec} onClick={startTransaction} disabled={isTransaction}>
          BEGIN
        </button>
        <button style={btnSec} onClick={commitTransaction} disabled={!isTransaction}>
          COMMIT
        </button>
        <button style={btnSec} onClick={rollbackTransaction} disabled={!isTransaction}>
          ROLLBACK
        </button>
      </div>

      {/* ---------- RESULTS ---------- */}
      {result && (
        <div style={{ background: "#0f172a", padding: 16, borderRadius: 12 }}>
          <h3>📊 Результат</h3>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr>
                {result.columns.map((c) => (
                  <th key={c} style={thStyle}>
                    {c}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {result.rows.map((r, i) => (
                <tr key={i}>
                  {r.map((v: any, j: number) => (
                    <td key={j} style={tdStyle}>
                      {String(v)}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* ---------- HISTORY ---------- */}
      <div style={{ marginTop: 20 }}>
        <h3>🕓 История запросов</h3>
        <ul>
          {history.map((h, i) => (
            <li key={i} style={{ opacity: 0.8, marginBottom: 4 }}>
              <code>{h}</code>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

/* ---------- styles ---------- */
const inputStyle = {
  background: "#0b1220",
  color: "#e5e7eb",
  border: "1px solid #1f2937",
  borderRadius: 8,
  padding: "8px 10px",
};

const selectStyle = {
  background: "#0b1220",
  color: "#e5e7eb",
  border: "1px solid #1f2937",
  borderRadius: 8,
  padding: "8px 10px",
};

const btnMain = {
  background: "linear-gradient(90deg,#22d3ee,#3b82f6)",
  color: "#0b1220",
  fontWeight: 700,
  border: "none",
  borderRadius: 10,
  padding: "8px 14px",
  cursor: "pointer",
};

const btnSec = {
  background: "#0b1220",
  color: "#e5e7eb",
  border: "1px solid #1f2937",
  borderRadius: 10,
  padding: "8px 14px",
  cursor: "pointer",
};

const thStyle = {
  borderBottom: "1px solid #1f2937",
  padding: "6px 10px",
  textAlign: "left",
};

const tdStyle = {
  borderBottom: "1px solid #1f2937",
  padding: "6px 10px",
};

const labelBox = {
  background: "#111827",
  padding: "6px 10px",
  borderRadius: 6,
  display: "flex",
  alignItems: "center",
  gap: 6,
};
