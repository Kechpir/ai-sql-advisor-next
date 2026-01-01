import { useState, useEffect, useRef } from "react";

interface FrequentQuery {
  sql: string;
  count: number;
}

interface FrequentQueriesDropdownProps {
  onSelectQuery: (sql: string) => void;
}

export default function FrequentQueriesDropdown({ onSelectQuery }: FrequentQueriesDropdownProps) {
  const [queries, setQueries] = useState<FrequentQuery[]>([]);
  const [loading, setLoading] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    loadFrequentQueries();
  }, []);

  // Закрываем dropdown при клике вне его
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const loadFrequentQueries = async () => {
    setLoading(true);
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
        setQueries(data.queries || []);
      }
    } catch (e) {
      console.error('Ошибка загрузки частых запросов:', e);
    } finally {
      setLoading(false);
    }
  };

  const handleSelect = (sql: string) => {
    onSelectQuery(sql);
    setIsOpen(false);
  };

  return (
    <div ref={dropdownRef} style={{ position: "relative", width: "100%" }}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        style={{
          width: "100%",
          padding: "10px 16px",
          background: "rgba(15, 23, 42, 0.8)",
          border: "1px solid rgba(51, 65, 85, 0.5)",
          borderRadius: "8px",
          color: "#e5e7eb",
          fontSize: "14px",
          cursor: "pointer",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
        }}
      >
        <span>🔥 Частые запросы</span>
        <span style={{ fontSize: "12px", color: "#9ca3af" }}>
          {isOpen ? "▲" : "▼"}
        </span>
      </button>

      {isOpen && (
        <div
          style={{
            position: "absolute",
            top: "100%",
            left: 0,
            right: 0,
            marginTop: "8px",
            background: "rgba(15, 23, 42, 0.98)",
            border: "1px solid rgba(51, 65, 85, 0.5)",
            borderRadius: "8px",
            boxShadow: "0 8px 32px rgba(0, 0, 0, 0.5)",
            zIndex: 1000,
            maxHeight: "400px",
            overflowY: "auto",
          }}
        >
          {loading ? (
            <div style={{ padding: "16px", textAlign: "center", color: "#9ca3af", fontSize: "14px" }}>
              Загрузка...
            </div>
          ) : queries.length === 0 ? (
            <div style={{ padding: "16px", textAlign: "center", color: "#9ca3af", fontSize: "14px" }}>
              Нет частых запросов
            </div>
          ) : (
            queries.map((query, index) => (
              <div
                key={index}
                onClick={() => handleSelect(query.sql)}
                style={{
                  padding: "12px 16px",
                  borderBottom: index < queries.length - 1 ? "1px solid rgba(51, 65, 85, 0.3)" : "none",
                  cursor: "pointer",
                  transition: "background 0.2s",
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = "rgba(34, 211, 238, 0.1)";
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = "transparent";
                }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "8px" }}>
                  <span style={{ color: "#22d3ee", fontSize: "12px", fontWeight: 600 }}>
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
                    maxHeight: "80px",
                    overflow: "hidden",
                  }}
                  title={query.sql}
                >
                  {query.sql.length > 100 ? `${query.sql.substring(0, 100)}...` : query.sql}
                </div>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}

