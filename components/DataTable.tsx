import React from "react";
import "../styles/sql-interface.css";

interface DataTableProps {
  data: any[];
  columns?: string[];
}

export default function DataTable({ data, columns }: DataTableProps) {
  if (!data || data.length === 0) {
    return (
      <div className="data-table empty">
        <p className="empty-text">Нет данных для отображения</p>
      </div>
    );
  }

  // Если columns не переданы, берём ключи из первой строки
  const tableColumns = columns && columns.length > 0 ? columns : Object.keys(data[0]);

  return (
    <div className="data-table-container">
      <table className="data-table">
        <thead>
          <tr>
            {tableColumns.map((col) => (
              <th key={col}>{col}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {data.map((row, rowIndex) => (
            <tr key={rowIndex}>
              {tableColumns.map((col) => (
                <td key={col}>{row[col] !== null && row[col] !== undefined ? row[col].toString() : ""}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
