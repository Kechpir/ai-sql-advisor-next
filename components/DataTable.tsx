import React, { useState } from "react";
import "../styles/sql-interface.css";

interface DataTableProps {
  data?: Record<string, any>[];
}

export default function DataTable({ data = [] }: DataTableProps) {
  // Если данных нет — пример для демо
  const demoData = [
    { id: 1, name: "Иван", email: "ivan@example.com", country: "RU", total: 230 },
    { id: 2, name: "Алия", email: "aliya@example.com", country: "KZ", total: 510 },
    { id: 3, name: "John", email: "john@example.com", country: "US", total: 190 },
  ];

  const rows = data.length > 0 ? data : demoData;

  const [tableData, setTableData] = useState(rows);
  const [sortField, setSortField] = useState<string | null>(null);
  const [sortDirection, setSortDirection] = useState<"ASC" | "DESC">("ASC");
  const [filter, setFilter] = useState<string>("");

  const headers = Object.keys(tableData[0] || {});

  // Сортировка
  const handleSort = (field: string) => {
    let direction = sortDirection === "ASC" ? "DESC" : "ASC";
    if (sortField !== field) direction = "ASC";

    const sorted = [...tableData].sort((a, b) => {
      if (a[field] < b[field]) return direction === "ASC" ? -1 : 1;
      if (a[field] > b[field]) return direction === "ASC" ? 1 : -1;
      return 0;
    });

    setSortField(field);
    setSortDirection(direction);
    setTableData(sorted);
  };

  // Inline редактирование
  const handleEdit = (rowIndex: number, field: string, value: string) => {
    const updated = [...tableData];
    updated[rowIndex][field] = value;
    setTableData(updated);
  };

  // Фильтрация
  const filteredData = tableData.filter((row) =>
    Object.values(row)
      .join(" ")
      .toLowerCase()
      .includes(filter.toLowerCase())
  );

  return (
    <div className="data-table-container">
      <div className="table-toolbar">
        <h2 className="panel-title">📊 Результаты запроса</h2>
        <input
          type="text"
          placeholder="🔍 Поиск..."
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          className="search-input"
        />
      </div>

      <div className="data-table-wrapper">
        <table className="data-table">
          <thead>
            <tr>
              {headers.map((header) => (
                <th key={header} onClick={() => handleSort(header)}>
                  {header}
                  {sortField === header && (
                    <span className="sort-indicator">
                      {sortDirection === "ASC" ? " ▲" : " ▼"}
                    </span>
                  )}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filteredData.map((row, rowIndex) => (
              <tr key={rowIndex}>
                {headers.map((field) => (
                  <td key={field}>
                    <input
                      type="text"
                      value={row[field]}
                      onChange={(e) => handleEdit(rowIndex, field, e.target.value)}
                    />
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
