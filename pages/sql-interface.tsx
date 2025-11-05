import React, { useState } from "react";
import SqlBuilderPanel from "../components/SqlBuilderPanel";
import DataTableModal from "../components/DataTableModal";

interface ModalData {
  id: string;
  sql: string;
  columns: string[];
  rows: any[];
}

export default function SqlInterfacePage() {
  const [modals, setModals] = useState<ModalData[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleExecute = async (jsonQuery: any) => {
    setLoading(true);
    setError(null);

    try {
      const res = await fetch("/api/fetch-query", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(jsonQuery),
      });

      const result = await res.json();
      if (!res.ok) throw new Error(result.error || "Ошибка при выполнении SQL");

      const id = Date.now().toString();
      const newModal: ModalData = {
        id,
        sql: result.sql || "SELECT ...",
        columns: result.columns || [],
        rows: result.rows || [],
      };

      setModals((prev) => [...prev, newModal]);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleCloseModal = (id: string) => {
    setModals((prev) => prev.filter((m) => m.id !== id));
  };

  return (
    <div className="sql-interface-page bg-gray-950 text-gray-100 min-h-screen p-6">
      <h1 className="text-2xl font-bold mb-4">🧠 AI SQL Конструктор</h1>

      <SqlBuilderPanel onExecute={handleExecute} />

      {loading && <p className="text-blue-400 mt-2">⏳ Выполняется запрос...</p>}
      {error && <p className="text-red-500 mt-2">❌ {error}</p>}

      {/* Рендер всех активных модалок */}
      {modals.map((modal) => (
        <DataTableModal
          key={modal.id}
          id={modal.id}
          sql={modal.sql}
          columns={modal.columns}
          rows={modal.rows}
          onClose={handleCloseModal}
        />
      ))}
    </div>
  );
}
