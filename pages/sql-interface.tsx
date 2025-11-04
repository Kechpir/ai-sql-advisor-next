import React, { useState } from "react";
import SqlBuilderPanel from "../components/SqlBuilderPanel";
import DataTable from "../components/DataTable";

export default function SqlInterfacePage() {
  const [tableData, setTableData] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  return (
    <div className="sql-interface-page">
      <SqlBuilderPanel />
      {loading && <p className="status-info">⏳ Выполняется запрос...</p>}
      {error && <p className="status-error">❌ {error}</p>}
      <DataTable data={tableData} />
    </div>
  );
}
