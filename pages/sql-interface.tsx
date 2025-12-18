import React, { useState, useEffect, useRef } from "react";
import Link from "next/link";
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
  const [connectionString, setConnectionString] = useState("");
  const [dbType, setDbType] = useState<string>("postgres");
  const [schema, setSchema] = useState<Record<string, string[]> | null>(null);
  const [selectedTable, setSelectedTable] = useState("");
  const [baseSql, setBaseSql] = useState<any>({});
  const [advancedSql, setAdvancedSql] = useState<any>({});
  const [expertSql, setExpertSql] = useState<any>({});
  const [modals, setModals] = useState<ModalData[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const wrapperRef = useRef<HTMLDivElement>(null);

  // Определяем тип БД из строки подключения
  const detectDbType = (url: string): string => {
    if (url.startsWith("mysql://")) return "mysql";
    if (url.startsWith("postgres://") || url.startsWith("postgresql://")) return "postgres";
    if (url.startsWith("sqlite://") || url.startsWith("file:")) return "sqlite";
    if (url.startsWith("mssql://")) return "mssql";
    return "postgres"; // по умолчанию
  };

  // ✅ фиксированный масштаб интерфейса (удобный тебе)
  const scale = 0.85;

  // 🔹 Загрузка схемы
  const fetchSchema = async (overrideUrl?: string) => {
    const url = overrideUrl || connectionString;
    if (!url) return alert("Введите строку подключения!");
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/fetch-schema", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ connectionString: url }),
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
      dbType: dbType,
      queryType: baseSql.queryType || "SELECT",
      table: baseSql.table,
      fields: baseSql.fields || [],
      filters: baseSql.filters || [],
      joins: advancedSql.joins || [],
      orderBy: baseSql.orderBy || [],
      groupBy: advancedSql.groupBy || [],
      having: advancedSql.having || "",
      aggregates: advancedSql.aggregates || [],
      caseWhen: advancedSql.caseWhen || "",
      union: advancedSql.union || "",
      ctes: expertSql.ctes || [],
      recursive: expertSql.recursive || false,
      expressions: advancedSql.expressions || [],
      windowFunctions: expertSql.windowFunctions || [],
      subqueries: expertSql.subqueries || [],
      jsonOps: expertSql.jsonOps || [],
      dateLogic: expertSql.dateLogic || [],
      queryHints: expertSql.queryHints || "",
      pagination: expertSql.pagination || { page: 1, pageSize: 50 },
      limit: baseSql.limit,
      offset: baseSql.offset,
      distinct: advancedSql.distinct || false,
      transactionMode: baseSql.transactionMode || false,
      connectionString,
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

  // Компенсация высоты после масштабирования
  useEffect(() => {
    if (wrapperRef.current) {
      const wrapper = wrapperRef.current;
      const scaledHeight = wrapper.scrollHeight * scale;
      const difference = wrapper.scrollHeight - scaledHeight;
      wrapper.style.marginBottom = `-${difference}px`;
    }
  }, [schema, baseSql, advancedSql, expertSql, scale]);

  // 🎨 UI
  return (
    <main
      className="flex flex-col items-center px-6 text-gray-100"
      style={{
        background:
          "radial-gradient(1000px 600px at 15% 10%, rgba(56,189,248,0.07), transparent 50%), radial-gradient(800px 400px at 90% 20%, rgba(99,102,241,0.10), transparent 50%), linear-gradient(180deg, #0b1220 0%, #0b1220 100%)",
        paddingTop: "0px",
        paddingBottom: "20px",
        width: "100%",
        flexShrink: 0,
        height: "fit-content",
        minHeight: "auto",
      }}
    >
      {/* 🔹 Вся панель с интерфейсом */}
      <div style={{ overflow: "hidden", width: "100%", height: "fit-content", paddingTop: "10px" }}>
        <div
          ref={wrapperRef}
          className="interface-wrapper"
          style={{
            transform: `scale(${scale})`,
            transformOrigin: "top center",
            width: "100%",
            maxWidth: "1400px",
            margin: "0 auto",
            marginBottom: "0",
            paddingBottom: "0",
          }}
        >
        <header className="text-center mb-8">
          <h1 className="text-3xl font-bold text-[#00d8ff] tracking-wide drop-shadow-lg">
            🧠 AI SQL Конструктор
          </h1>
          <p className="text-gray-400 text-sm mt-2">
            Визуальное создание, выполнение и анализ SQL-запросов
          </p>
          {/* кнопка перехода */}
          <div style={{ display: "flex", justifyContent: "center", margin: "20px 0 0" }}>
            <Link
              href="/"
              style={{
                display: "inline-block",
                padding: "12px 26px",
                borderRadius: 14,
                textDecoration: "none",
                background: "linear-gradient(90deg,#22d3ee,#3b82f6)",
                color: "#0b1220",
                fontWeight: 700,
                fontSize: 16,
                boxShadow: "0 0 14px rgba(59,130,246,0.45)",
                transition: "transform 0.2s ease, box-shadow 0.25s ease",
                marginTop: "22px",
                marginBottom: "22px",
                height: "48px",
              }}
              onMouseOver={(e) => {
                e.currentTarget.style.transform = "scale(1.05)";
                e.currentTarget.style.boxShadow = "0 0 20px rgba(59,130,246,0.7)";
              }}
              onMouseOut={(e) => {
                e.currentTarget.style.transform = "scale(1)";
                e.currentTarget.style.boxShadow = "0 0 14px rgba(59,130,246,0.45)";
              }}
            >
              🚀 Перейти в SQL Асистента
            </Link>
          </div>
        </header>

        {/* 🔸 Верхняя панель действий */}
        <div
          className="main-card"
          style={{
            padding: "1rem 1.5rem",
            marginBottom: "1.25rem",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            gap: "1rem",
          }}
        >
          <div style={{ minWidth: 0 }}>
            <div style={{ fontSize: "0.75rem", color: "#9ca3af" }}>Текущее подключение</div>
            <div
              style={{
                fontSize: "0.85rem",
                color: "#e5e7eb",
                fontFamily: "monospace",
                whiteSpace: "nowrap",
                overflow: "hidden",
                textOverflow: "ellipsis",
                maxWidth: "420px",
              }}
            >
              {connectionString || "не выбрано"}
            </div>
          </div>

          <div style={{ display: "flex", gap: "0.75rem" }}>
            <button
              className="btn btn-sec"
              onClick={() => fetchSchema()}
              disabled={!connectionString || loading}
            >
              {loading ? "⏳ Выполняется..." : "🔄 Обновить схему"}
            </button>
            <button
              className="btn btn-main"
              onClick={handleExecute}
              disabled={!connectionString || loading}
            >
              ▶ Выполнить запрос
            </button>
          </div>
        </div>

        {/* 🔌 Панель подключений */}
        <ConnectionsPanel
          onConnect={(url) => {
            setConnectionString(url);
            setDbType(detectDbType(url));
            fetchSchema(url);
          }}
        />

        {/* Панели SQL */}
        <h3
          style={{
            color: "rgb(34, 211, 238)",
            height: "25px",
            paddingTop: "0px",
            paddingBottom: "0px",
            marginTop: "19px",
            marginBottom: "19px",
          }}
        >
          ⚙️ Основные SQL операции
        </h3>
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

        {/* Ошибки */}
        {error && (
          <p className="text-red-400 mt-3 mb-0 text-center">❌ {error}</p>
        )}
        </div>
      </div>

      {/* Результаты SQL */}
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

      {/* Плавающая кнопка "Выполнить" справа по центру */}
      {connectionString && (
        <button
          onClick={handleExecute}
          disabled={loading}
          style={{
            position: "fixed",
            right: "30px",
            top: "50%",
            transform: "translateY(-50%)",
            zIndex: 998,
            width: "60px",
            height: "60px",
            borderRadius: "50%",
            background: loading 
              ? "linear-gradient(135deg, #6b7280, #4b5563)"
              : "linear-gradient(135deg, #22d3ee, #3b82f6)",
            border: "none",
            cursor: loading ? "not-allowed" : "pointer",
            boxShadow: loading
              ? "0 4px 12px rgba(0, 0, 0, 0.3)"
              : "0 6px 20px rgba(59, 130, 246, 0.5), 0 0 0 3px rgba(59, 130, 246, 0.2)",
            transition: "all 0.3s ease",
            opacity: loading ? 0.7 : 1,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: "20px",
            color: "#0b1220",
            fontWeight: 700,
            pointerEvents: "auto",
            lineHeight: 1,
          }}
          onMouseEnter={(e) => {
            if (!loading) {
              e.currentTarget.style.transform = "translateY(-50%) scale(1.1)";
              e.currentTarget.style.boxShadow = "0 8px 24px rgba(59, 130, 246, 0.7), 0 0 0 4px rgba(59, 130, 246, 0.3)";
            }
          }}
          onMouseLeave={(e) => {
            if (!loading) {
              e.currentTarget.style.transform = "translateY(-50%) scale(1)";
              e.currentTarget.style.boxShadow = "0 6px 20px rgba(59, 130, 246, 0.5), 0 0 0 3px rgba(59, 130, 246, 0.2)";
            }
          }}
          onMouseDown={(e) => {
            if (!loading) {
              e.currentTarget.style.transform = "translateY(-50%) scale(0.95)";
            }
          }}
          onMouseUp={(e) => {
            if (!loading) {
              e.currentTarget.style.transform = "translateY(-50%) scale(1.1)";
            }
          }}
          title={loading ? "Выполняется..." : "Выполнить запрос"}
        >
          {loading ? (
            <span 
              style={{ 
                display: "inline-block", 
                animation: "spin 1s linear infinite",
                transformOrigin: "center",
                lineHeight: 1,
              }}
            >
              ⏳
            </span>
          ) : (
            <span style={{ 
              display: "inline-block",
              lineHeight: 1,
              paddingLeft: "2px",
            }}>
              ▶
            </span>
          )}
        </button>
      )}
    </main>
  );
}
