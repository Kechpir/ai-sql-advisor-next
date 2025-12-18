import React from "react";

interface SqlModalProps {
  isOpen: boolean;
  onClose: () => void;
  result: any;
}

export default function SqlModal({ isOpen, onClose, result }: SqlModalProps) {
  if (!isOpen) return null;

  const renderContent = () => {
    if (!result) return <p>Нет данных для отображения</p>;

    // Ошибка
    if (result.error) {
      return <p style={{ color: "#ff4d4d" }}>❌ Ошибка: {result.error}</p>;
    }

    // JSON
    if (typeof result === "object" && !Array.isArray(result)) {
      return <pre className="sql-output">{JSON.stringify(result, null, 2)}</pre>;
    }

    // Таблица
    if (Array.isArray(result) && result.length > 0) {
      const columns = Object.keys(result[0]);
      return (
        <table
          style={{
            width: "100%",
            borderCollapse: "collapse",
            marginTop: "1rem",
            color: "#e5e7eb",
            background: "rgba(10,15,25,0.6)",
          }}
        >
          <thead>
            <tr style={{ borderBottom: "1px solid rgba(0,216,255,0.2)" }}>
              {columns.map((col) => (
                <th
                  key={col}
                  style={{
                    padding: "0.5rem",
                    textAlign: "left",
                    color: "#00d8ff",
                  }}
                >
                  {col}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {result.map((row, i) => (
              <tr key={i} style={{ borderBottom: "1px solid rgba(0,216,255,0.1)" }}>
                {columns.map((col) => (
                  <td key={col} style={{ padding: "0.5rem" }}>
                    {row[col]}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      );
    }

    // Текст
    return <pre className="sql-output">{String(result)}</pre>;
  };

  return (
    <div
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        width: "100vw",
        height: "100vh",
        background: "rgba(0,0,0,0.65)",
        backdropFilter: "blur(8px)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 1000,
      }}
    >
      <div
        className="sql-builder-panel"
        style={{ maxWidth: 800, width: "90%", padding: "2rem" }}
      >
        <h2 className="section-title">📊 Результат выполнения</h2>

        <div
          style={{
            maxHeight: "60vh",
            overflowY: "auto",
            border: "1px solid rgba(0,216,255,0.15)",
            borderRadius: "10px",
            padding: "1rem",
          }}
        >
          {renderContent()}
        </div>

        <div className="flex justify-end mt-4">
          <button className="delete-btn" onClick={onClose}>
            Закрыть
          </button>
        </div>
      </div>
    </div>
  );
}
