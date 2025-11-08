import React, { useState } from "react";
import BaseSqlPanel from "@/components/SqlBuilderPanel/BaseSqlPanel";
import AdvancedSqlPanel from "@/components/SqlBuilderPanel/AdvancedSqlPanel";
import ExpertSqlPanel from "@/components/SqlBuilderPanel/ExpertSqlPanel";
import ConnectionsPanel from "@/components/SqlBuilderPanel/ConnectionsPanel";
import DataTableModal from "@/components/DataTableModal";

interface ModalData {
  id: string;
  sql: string;
  columns: string[];
  rows: any[];
}

export default function SqlInterfacePage() {
  const [query, setQuery] = useState<any>({});
  const [connectionString, setConnectionString] = useState("");
  const [schema, setSchema] = useState<Record<string, string[]> | null>(null);
  const [selectedTable, setSelectedTable] = useState("");
  const [baseSql, setBaseSql] = useState<any>({});
  const [advancedSql, setAdvancedSql] = useState<any>({});
  const [expertSql, setExpertSql] = useState<any>({});
  const [modals, setModals] = useState<ModalData[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // 🔹 Загрузка схемы из API
  const fetchSchema = async () => {
    if (!connectionString) return alert("Введите строку подключения!");
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/fetch-schema", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ connectionString }),
      });
      const data = await res.json();
      if (data.success) setSchema(data.schema);
      else throw new Error(data.error || "Ошибка загрузки схемы");
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  // ⚙️ Выполнение SQL
  const handleExecute = async () => {
    if (!connectionString) return alert("Не выбрано подключение!");
    setLoading(true);
    setError(null);

    const jsonQuery = {
      dbType: baseSql.dbType || "postgres",
      queryType: baseSql.queryType || "SELECT",
      table: baseSql.table,
      fields: baseSql.fields || [],
      filters: baseSql.filters || [],
      joins: baseSql.joins || [],
      groupBy: advancedSql.groupBy || [],
      having: advancedSql.having || "",
      aggregates: advancedSql.aggregates || [],
      caseWhen: advancedSql.caseWhenList || [],
      ctes: advancedSql.ctes || [],
      unions: advancedSql.unions || [],
      expressions: advancedSql.expressions || [],
      windowFunctions: expertSql.windowFunctions || [],
      subqueries: expertSql.subqueries || [],
      jsonOps: expertSql.jsonOps || [],
      dateLogic: expertSql.dateLogic || [],
      queryHints: expertSql.queryHints || [],
      pagination: expertSql.pagination || { page: 1, pageSize: 50 },
      transactionMode: baseSql.transactionMode || false,
      connectionString, // ✅ теперь строка реально уходит на сервер
    };

    try {
      const res = await fetch("/api/fetch-query", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(jsonQuery),
      });

      const result = await res.json();
      if (!res.ok) throw new Error(result.error || "Ошибка SQL");

      const id = Date.now().toString();
      setModals((prev) => [
        ...prev,
        {
          id,
          sql: result.sql || "",
          columns: result.columns || [],
          rows: result.rows || [],
        },
      ]);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleCloseModal = (id: string) => {
    setModals((prev) => prev.filter((m) => m.id !== id));
  };

  // 🎨 UI
  return (
    <main
      className="flex flex-col items-center min-h-screen px-6 py-10 text-gray-100"
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

        {/* 🔌 Панель подключений */}
        <ConnectionsPanel onSelect={setConnectionString} />

        {/* Подключение и обновление схемы */}
        <div className="flex gap-2 mb-6">
          <button
            onClick={fetchSchema}
            disabled={loading}
            className="add-btn px-5"
          >
            🔄 {loading ? "Загрузка..." : "Обновить схему"}
          </button>
        </div>

        {/* Панели */}
        <BaseSqlPanel
          schema={schema}
          selectedTable={selectedTable}
          setSelectedTable={setSelectedTable}
          onChange={setBaseSql}
          onExecute={handleExecute}
        />

        <AdvancedSqlPanel
          schema={schema}
          selectedTable={selectedTable}
          onChange={setAdvancedSql}
        />

        <ExpertSqlPanel
          schema={schema}
          selectedTable={selectedTable}
          onChange={setExpertSql}
        />

        {/* Кнопка выполнения */}
        <div className="flex justify-end mt-6">
          <button
            onClick={handleExecute}
            disabled={loading}
            className="add-btn px-6 py-2"
          >
            ⚡ {loading ? "Выполнение..." : "Выполнить SQL"}
          </button>
        </div>

        {/* Ошибки */}
        {error && (
          <p className="text-red-400 mt-3 text-center">❌ {error}</p>
        )}
      </div>

      {/* Результаты (модалки) */}
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
