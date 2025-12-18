import React, { useState, useEffect, useRef } from "react";

interface DataTableModalProps {
  id: string;
  sql: string;
  columns: string[];
  rows: any[];
  onClose: (id: string) => void;
}

export default function DataTableModal({ id, sql, columns, rows, onClose }: DataTableModalProps) {
  const [size, setSize] = useState({ width: 95, height: 90 }); // проценты
  const modalRef = useRef<HTMLDivElement | null>(null);
  const tableContainerRef = useRef<HTMLDivElement | null>(null);

  // Ресайз по колесику мыши (Ctrl + Scroll)
  useEffect(() => {
    const handleWheel = (e: WheelEvent) => {
      if (e.ctrlKey) {
        e.preventDefault();
        setSize((prev) => {
          const delta = e.deltaY > 0 ? -5 : 5;
          return {
            width: Math.max(40, Math.min(100, prev.width + delta)),
            height: Math.max(40, Math.min(100, prev.height + delta)),
          };
        });
      }
    };
    window.addEventListener("wheel", handleWheel, { passive: false });
    return () => window.removeEventListener("wheel", handleWheel);
  }, []);

  // Копирование в буфер обмена
  const copyToClipboard = () => {
    if (rows.length === 0) return;
    
    // Формируем CSV формат
    const headers = columns.join("\t");
    const dataRows = rows.map(row => 
      columns.map(col => {
        const value = row[col];
        if (value === null || value === undefined) return "";
        // Экранируем табы и переносы строк
        return String(value).replace(/\t/g, " ").replace(/\n/g, " ");
      }).join("\t")
    );
    const csv = [headers, ...dataRows].join("\n");
    
    navigator.clipboard.writeText(csv);
    alert("Данные скопированы в буфер обмена!");
  };

  return (
    <div
      ref={modalRef}
      style={{
        position: "fixed",
        inset: 0,
        backgroundColor: "rgba(0, 0, 0, 0.7)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 1000,
      }}
      onClick={(e) => {
        if (e.target === modalRef.current) onClose(id);
      }}
    >
      <div
        style={{
          backgroundColor: "#ffffff",
          borderRadius: "8px",
          boxShadow: "0 10px 40px rgba(0, 0, 0, 0.3)",
          padding: "16px",
          position: "relative",
          display: "flex",
          flexDirection: "column",
          width: `${size.width}%`,
          height: `${size.height}%`,
          maxWidth: "98vw",
          maxHeight: "98vh",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Заголовок */}
        <div style={{ 
          display: "flex", 
          justifyContent: "space-between", 
          alignItems: "center",
          marginBottom: "12px",
          paddingBottom: "12px",
          borderBottom: "2px solid #d0d0d0"
        }}>
          <h3 style={{ 
            margin: 0, 
            fontSize: "18px", 
            fontWeight: 600,
            color: "#1a1a1a"
          }}>
            📊 Результат SQL-запроса ({rows.length} строк)
          </h3>
          <div style={{ display: "flex", gap: "8px" }}>
            <button
              onClick={copyToClipboard}
              style={{
                padding: "6px 12px",
                fontSize: "13px",
                backgroundColor: "#0078d4",
                color: "white",
                border: "none",
                borderRadius: "4px",
                cursor: "pointer",
                fontWeight: 500,
              }}
              onMouseOver={(e) => e.currentTarget.style.backgroundColor = "#106ebe"}
              onMouseOut={(e) => e.currentTarget.style.backgroundColor = "#0078d4"}
            >
              📋 Копировать
            </button>
            <button
              onClick={() => setSize({ width: 70, height: 70 })}
              style={{
                padding: "6px 12px",
                fontSize: "13px",
                backgroundColor: "#f3f3f3",
                color: "#1a1a1a",
                border: "1px solid #d0d0d0",
                borderRadius: "4px",
                cursor: "pointer",
              }}
              onMouseOver={(e) => e.currentTarget.style.backgroundColor = "#e5e5e5"}
              onMouseOut={(e) => e.currentTarget.style.backgroundColor = "#f3f3f3"}
            >
              🧩 Свернуть
            </button>
            <button
              onClick={() => setSize({ width: 95, height: 90 })}
              style={{
                padding: "6px 12px",
                fontSize: "13px",
                backgroundColor: "#f3f3f3",
                color: "#1a1a1a",
                border: "1px solid #d0d0d0",
                borderRadius: "4px",
                cursor: "pointer",
              }}
              onMouseOver={(e) => e.currentTarget.style.backgroundColor = "#e5e5e5"}
              onMouseOut={(e) => e.currentTarget.style.backgroundColor = "#f3f3f3"}
            >
              ⬜ Нормально
            </button>
            <button
              onClick={() => onClose(id)}
              style={{
                padding: "6px 12px",
                fontSize: "13px",
                backgroundColor: "#d13438",
                color: "white",
                border: "none",
                borderRadius: "4px",
                cursor: "pointer",
                fontWeight: 500,
              }}
              onMouseOver={(e) => e.currentTarget.style.backgroundColor = "#c02a2e"}
              onMouseOut={(e) => e.currentTarget.style.backgroundColor = "#d13438"}
            >
              ✖ Закрыть
            </button>
          </div>
        </div>

        {/* SQL запрос */}
        <div style={{ 
          fontSize: "12px", 
          color: "#666",
          marginBottom: "12px",
          padding: "8px",
          backgroundColor: "#f9f9f9",
          borderRadius: "4px",
          fontFamily: "monospace",
          border: "1px solid #e0e0e0"
        }}>
          SQL: {sql}
        </div>

        {/* Таблица в стиле Excel */}
        <div 
          ref={tableContainerRef}
          style={{
            flex: 1,
            overflow: "auto",
            border: "1px solid #d0d0d0",
            backgroundColor: "#ffffff",
            position: "relative",
          }}
        >
          <table
            style={{
              width: "100%",
              borderCollapse: "collapse",
              fontSize: "13px",
              fontFamily: "Segoe UI, Arial, sans-serif",
            }}
          >
            <thead style={{ position: "sticky", top: 0, zIndex: 10 }}>
              <tr>
                {/* Колонка с номерами строк */}
                <th
                  style={{
                    backgroundColor: "#f2f2f2",
                    border: "1px solid #d0d0d0",
                    padding: "8px 12px",
                    textAlign: "center",
                    fontWeight: 600,
                    color: "#1a1a1a",
                    minWidth: "50px",
                    position: "sticky",
                    left: 0,
                    zIndex: 11,
                    boxShadow: "2px 0 2px rgba(0,0,0,0.1)",
                  }}
                >
                  #
                </th>
                {columns.map((col) => (
                  <th
                    key={col}
                    style={{
                      backgroundColor: "#f2f2f2",
                      border: "1px solid #d0d0d0",
                      padding: "8px 12px",
                      textAlign: "left",
                      fontWeight: 600,
                      color: "#1a1a1a",
                      whiteSpace: "nowrap",
                      minWidth: "120px",
                    }}
                  >
                    {col}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.length > 0 ? (
                rows.map((row, i) => (
                  <tr
                    key={i}
                    style={{
                      backgroundColor: i % 2 === 0 ? "#ffffff" : "#f9f9f9",
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.backgroundColor = "#e8f4f8";
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.backgroundColor = i % 2 === 0 ? "#ffffff" : "#f9f9f9";
                    }}
                  >
                    {/* Номер строки */}
                    <td
                      style={{
                        backgroundColor: "#f2f2f2",
                        border: "1px solid #d0d0d0",
                        padding: "6px 12px",
                        textAlign: "center",
                        color: "#666",
                        fontWeight: 500,
                        position: "sticky",
                        left: 0,
                        zIndex: 1,
                        boxShadow: "2px 0 2px rgba(0,0,0,0.1)",
                      }}
                    >
                      {i + 1}
                    </td>
                    {columns.map((col) => (
                      <td
                        key={col}
                        style={{
                          border: "1px solid #d0d0d0",
                          padding: "6px 12px",
                          color: "#1a1a1a",
                          whiteSpace: "nowrap",
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                          maxWidth: "300px",
                        }}
                        title={row[col] !== null && row[col] !== undefined ? String(row[col]) : ""}
                      >
                        {row[col] !== null && row[col] !== undefined ? String(row[col]) : ""}
                      </td>
                    ))}
                  </tr>
                ))
              ) : (
                <tr>
                  <td
                    colSpan={columns.length + 1}
                    style={{
                      textAlign: "center",
                      padding: "40px",
                      color: "#999",
                      fontSize: "14px",
                    }}
                  >
                    Нет данных
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
