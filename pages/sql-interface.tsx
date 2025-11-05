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
    <main
      className="flex flex-col items-center justify-start min-h-screen px-6 py-10 text-gray-100"
      style={{
        background:
          "radial-gradient(1000px 600px at 15% 10%, rgba(56,189,248,0.07), transparent 50%), radial-gradient(800px 400px at 90% 20%, rgba(99,102,241,0.10), transparent 50%), linear-gradient(180deg, #0b1220 0%, #0b1220 100%)",
      }}
    >
      <div
        className="w-full max-w-6xl rounded-2xl shadow-2xl border border-[#1a1a1a]"
        style={{
          background:
            "linear-gradient(180deg, rgba(17,17,17,0.9) 0%, rgba(20,20,20,0.95) 100%)",
          backdropFilter: "blur(10px)",
          padding: "30px",
        }}
      >
        <header className="text-center mb-8">
          <h1 className="text-3xl font-bold text-[#00d8ff] tracking-wide drop-shadow-lg">
            🧠 AI SQL Конструктор
          </h1>
          <p className="text-gray-400 text-sm mt-2">
            Визуальное создание, выполнение и анализ SQL-запросов
          </p>
        </header>

        {/* Панель конструктора SQL */}
        <section className="mb-6">
          <SqlBuilderPanel onExecute={handleExecute} />
        </section>

        {/* Состояния загрузки / ошибок */}
        <div className="text-center mt-4">
          {loading && <p className="text-blue-400">⏳ Выполняется запрос...</p>}
          {error && <p className="text-red-500">❌ {error}</p>}
        </div>
      </div>

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
    </main>
  );
}
