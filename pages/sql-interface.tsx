import React, { useState } from "react";
import SqlBuilderPanel from "../components/SqlBuilderPanel";
import DataTable from "../components/DataTable";

export default function SqlInterfacePage() {
  const [tableData, setTableData] = useState<any[]>([]);
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

      // Сохраняем результат
      setTableData(result.data || []);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="sql-interface-page">
      <SqlBuilderPanel onExecute={handleExecute} />
      {loading && <p className="status-info">⏳ Выполняется запрос...</p>}
      {error && <p className="status-error">❌ {error}</p>}
      <DataTable data={tableData} />
    </div>
  );
}
