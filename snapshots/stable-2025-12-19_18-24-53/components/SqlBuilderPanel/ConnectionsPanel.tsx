import React, { useState, useEffect, useRef } from "react";

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
  onConnect?: (url: string) => void;
}

export default function ConnectionsPanel({ onConnect }: Props) {
  const [connections, setConnections] = useState<Connection[]>([]);
  const [selectedSaved, setSelectedSaved] = useState<string>("");
  const [dropdownOpen, setDropdownOpen] = useState<boolean>(false);
  const [newConn, setNewConn] = useState<Connection>({
    name: "",
    host: "",
    port: "5432",
    database: "",
    user: "",
    password: "",
    dialect: "postgres",
  });

  const dropdownRef = useRef<HTMLDivElement>(null);

  // Загружаем сохранённые соединения
  useEffect(() => {
    const saved = localStorage.getItem("savedConnections");
    if (saved) setConnections(JSON.parse(saved));
  }, []);

  // Закрываем дропдаун при клике вне его
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setDropdownOpen(false);
      }
    };

    if (dropdownOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [dropdownOpen]);

  const saveConnections = (list: Connection[]) => {
    localStorage.setItem("savedConnections", JSON.stringify(list));
    setConnections(list);
  };

  const handleAdd = () => {
    if (!newConn.name || !newConn.host || !newConn.database) return alert("❗ Заполни обязательные поля");
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
  };

  const handleDelete = (name: string) => {
    const filtered = connections.filter((c) => c.name !== name);
    saveConnections(filtered);
  };

  const connect = (conn: Connection) => {
    // Формируем правильную строку подключения в зависимости от диалекта
    let url = "";
    const dialect = conn.dialect.toLowerCase();
    
    if (dialect === "postgres" || dialect === "postgresql") {
      url = `postgresql://${conn.user}:${encodeURIComponent(conn.password)}@${conn.host}:${conn.port}/${conn.database}?sslmode=require`;
    } else if (dialect === "mysql") {
      url = `mysql://${conn.user}:${encodeURIComponent(conn.password)}@${conn.host}:${conn.port}/${conn.database}`;
    } else if (dialect === "sqlite") {
      url = `file:${conn.database}`;
    } else if (dialect === "mssql") {
      // MSSQL использует другой формат
      url = `mssql://${conn.user}:${encodeURIComponent(conn.password)}@${conn.host}:${conn.port}/${conn.database}`;
    } else {
      // По умолчанию PostgreSQL
      url = `postgresql://${conn.user}:${encodeURIComponent(conn.password)}@${conn.host}:${conn.port}/${conn.database}?sslmode=require`;
    }
    
    onConnect?.(url);
  };

  return (
    <div className="main-card" style={{ marginTop: "1rem", marginBottom: "14px" }}>
      <h3 style={{ color: "#22d3ee" }}>🔗 Подключения к базам данных</h3>

      <div style={{ marginTop: "0.75rem", marginBottom: "0.75rem", position: "relative" }}>
        <label style={{ display: "block", marginBottom: "0.35rem", fontSize: "0.85rem", color: "#9ca3af" }}>
          Выбрать сохранённое подключение
        </label>
        <div style={{ position: "relative" }} ref={dropdownRef}>
          {/* Кастомный дропдаун */}
          <div
            onClick={() => connections.length > 0 && setDropdownOpen(!dropdownOpen)}
            style={{
              background: "#0b1220",
              color: "#e5e7eb",
              border: "1px solid #1f2937",
              borderRadius: "12px",
              padding: "10px 40px 10px 12px",
              width: "100%",
              cursor: connections.length > 0 ? "pointer" : "not-allowed",
              opacity: connections.length === 0 ? 0.5 : 1,
              position: "relative",
              minHeight: "39px",
              display: "flex",
              alignItems: "center",
            }}
          >
            <span style={{ flex: 1 }}>
              {selectedSaved
                ? `${connections.find((c) => c.name === selectedSaved)?.name} — ${connections.find((c) => c.name === selectedSaved)?.dialect}@${connections.find((c) => c.name === selectedSaved)?.host}:${connections.find((c) => c.name === selectedSaved)?.port}/${connections.find((c) => c.name === selectedSaved)?.database}`
                : connections.length === 0
                ? "нет сохранённых подключений"
                : "— не выбрано —"}
            </span>
            <span
              style={{
                position: "absolute",
                right: "14px",
                top: "50%",
                transform: "translateY(-50%)",
                color: "#9ca3af",
                fontSize: "12px",
                pointerEvents: "none",
              }}
            >
              {dropdownOpen ? "▲" : "▼"}
            </span>
          </div>

          {/* Выпадающий список */}
          {dropdownOpen && connections.length > 0 && (
            <div
              style={{
                position: "absolute",
                top: "100%",
                left: 0,
                right: 0,
                marginTop: "4px",
                background: "#0b1220",
                border: "1px solid #1f2937",
                borderRadius: "12px",
                maxHeight: "300px",
                overflowY: "auto",
                zIndex: 1000,
                boxShadow: "0 4px 12px rgba(0, 0, 0, 0.3)",
              }}
            >
              {/* Опция "не выбрано" */}
              <div
                onClick={() => {
                  setSelectedSaved("");
                  setDropdownOpen(false);
                }}
                style={{
                  padding: "10px 12px",
                  cursor: "pointer",
                  borderBottom: "1px solid #1f2937",
                  color: "#9ca3af",
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = "#111827";
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = "transparent";
                }}
              >
                — не выбрано —
              </div>

              {/* Список подключений */}
              {connections.map((c) => (
                <div
                  key={c.name}
                  style={{
                    padding: "10px 12px",
                    cursor: "pointer",
                    borderBottom: "1px solid #1f2937",
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    gap: "8px",
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.background = "#111827";
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background = "transparent";
                  }}
                >
                  <span
                    onClick={() => {
                      setSelectedSaved(c.name);
                      setNewConn(c);
                      connect(c);
                      setDropdownOpen(false);
                    }}
                    style={{ flex: 1 }}
                  >
                    {c.name} — {c.dialect}@{c.host}:{c.port}/{c.database}
                  </span>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      if (confirm(`Удалить подключение "${c.name}"?`)) {
                        handleDelete(c.name);
                        if (selectedSaved === c.name) {
                          setSelectedSaved("");
                        }
                      }
                    }}
                    style={{
                      background: "rgba(239, 68, 68, 0.1)",
                      border: "1px solid rgba(239, 68, 68, 0.3)",
                      color: "#ef4444",
                      cursor: "pointer",
                      padding: "4px 10px",
                      borderRadius: "6px",
                      fontSize: "12px",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      whiteSpace: "nowrap",
                      fontWeight: 500,
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.background = "rgba(239, 68, 68, 0.2)";
                      e.currentTarget.style.borderColor = "rgba(239, 68, 68, 0.5)";
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.background = "rgba(239, 68, 68, 0.1)";
                      e.currentTarget.style.borderColor = "rgba(239, 68, 68, 0.3)";
                    }}
                    title="Удалить подключение"
                  >
                    Удалить
                  </button>
                </div>
              ))}
            </div>
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
        <button className="btn btn-main" onClick={handleAdd}>
          💾 Сохранить
        </button>
      </div>

      {connections.length > 0 && (
        <div style={{ marginTop: "1.5rem" }}>
          <h4 style={{ color: "#38bdf8" }}>Сохранённые подключения</h4>
          {connections.map((conn) => (
            <div
              key={conn.name}
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                border: "1px solid #1f2937",
                borderRadius: 10,
                padding: "0.6rem 1rem",
                marginTop: "0.6rem",
                background: "#0b1220",
              }}
            >
              <span>
                {conn.name} — {conn.dialect}@{conn.host}:{conn.port}/{conn.database}
              </span>
              <button className="btn btn-sec" onClick={() => connect(conn)}>
                🔌 Подключить
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
