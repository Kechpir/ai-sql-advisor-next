import React, { useState, useEffect, useRef } from "react";

interface DataTableModalProps {
  id: string;
  sql: string;
  columns: string[];
  rows: any[];
  onClose: (id: string) => void;
}

export default function DataTableModal({ id, sql, columns, rows, onClose }: DataTableModalProps) {
  const [size, setSize] = useState({ width: 90, height: 80 }); // проценты
  const modalRef = useRef<HTMLDivElement | null>(null);

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

  return (
    <div
      ref={modalRef}
      className="fixed inset-0 bg-black bg-opacity-70 flex items-center justify-center z-50"
    >
      <div
        className="bg-gray-900 text-gray-100 rounded-lg shadow-lg p-4 relative overflow-auto"
        style={{
          width: `${size.width}%`,
          height: `${size.height}%`,
        }}
      >
        <div className="flex justify-between items-center mb-2">
          <h3 className="font-semibold text-lg">📊 Результат SQL-запроса</h3>
          <div className="flex gap-2">
            <button
              onClick={() => setSize({ width: 60, height: 60 })}
              className="px-2 py-1 text-sm bg-gray-700 hover:bg-gray-600 rounded"
            >
              🧩 Свернуть
            </button>
            <button
              onClick={() => setSize({ width: 90, height: 80 })}
              className="px-2 py-1 text-sm bg-gray-700 hover:bg-gray-600 rounded"
            >
              ⬜ Нормально
            </button>
            <button
              onClick={() => onClose(id)}
              className="px-2 py-1 text-sm bg-red-600 hover:bg-red-700 rounded"
            >
              ✖ Закрыть
            </button>
          </div>
        </div>

        <div className="text-xs text-gray-400 mb-2">SQL: {sql}</div>

        <div className="overflow-auto max-h-[90%] border border-gray-700 rounded">
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr className="bg-gray-800">
                {columns.map((col) => (
                  <th key={col} className="px-3 py-2 border-b border-gray-700 text-left">
                    {col}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.length > 0 ? (
                rows.map((row, i) => (
                  <tr key={i} className="hover:bg-gray-800">
                    {columns.map((col) => (
                      <td key={col} className="px-3 py-1 border-b border-gray-800">
                        {row[col] !== null && row[col] !== undefined ? row[col].toString() : ""}
                      </td>
                    ))}
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={columns.length} className="text-center text-gray-400 py-4">
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
