import React, { useState } from "react";
import "../styles/sql-interface.css";

interface DataTableProps {
  data?: Record<string, any>[];
}

export default function DataTable({ data = [] }: DataTableProps) {
  // 🔹 Пример демо-данных (если нет API-результата)
  const demoData: Record<string, any>[] = [
    { id: 1, name: "Иван", email: "ivan@example.com", country: "RU", total: 230 },
    { id: 2, name: "Алия", email: "aliya@example.com", country: "KZ", total: 510 },
    { id: 3, name: "John", email: "john@example.com", country: "US", total: 190 },
  ];

  // Если данных нет, показываем демо
  const rows = Array.isArray(data) && data.length > 0 ? data : demoData;

  // 🧠 Состояния
  const [tableData, setTableData] = useState<Record<string, any>[]>(rows);
  const [sortField, setSortField] = useState<string | null>(null);
  const [sortDirection, setSortDirection] = useState<"ASC" | "DESC">("ASC");
  const [filter, setFilter] = useState<string>("");

  // 🧩 Заголовки таблицы
  const headers = Object.keys(tableData[0] || {});

  // ⚙️ Сортировка по клику на заголовок
  const handleSort = (field: string) => {
    if (!field) return;

    let direction: "ASC" | "DESC" = sortDirection === "ASC" ? "DESC" : "ASC";
    if (sortField !== field) direction = "ASC";

    const sorted = [...tableData].sort((a, b) => {
      const valA = a[field];
      const valB = b[field];

      // Безопасное сравнение
      if (valA == null || valB == null) return 0;
      if (valA < valB) return direction === "ASC" ? -1 : 1;
      if (valA > valB) return direction === "ASC" ? 1 : -1;
      return 0;
    });

    setSortField(field);
    setSortDirection(direction);
    setTableData(sorted);
  };

  // ✏️ Inline-редактирование ячеек
  const handleEdit = (rowIndex: number, field: string, value: string) => {
    const updated = [...tableData];
    if (!updated[rowIndex]) return;
    updated[rowIndex][field] = value;
    setTableData(updated);
  };

  // 🔍 Фильтрация по строкам
  const filteredData = tableData.filter((row) =>
    Object.values(row)
      .join(" ")
      .toLowerCase()
      .includes(filter.toLowerCase())
  );

  return (
    <div className="data-table-container">
      {/* Верхняя панель таблицы */}
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

      {/* Таблица */}
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
            {filteredData.length > 0 ? (
              filteredData.map((row, rowIndex) => (
                <tr key={rowIndex}>
                  {headers.map((field) => (
                    <td key={field}>
                      <input
                        type="text"
                        value={row[field] ?? ""}
                        onChange={(e) => handleEdit(rowIndex, field, e.target.value)}
                      />
                    </td>
                  ))}
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={headers.length} style={{ textAlign: "center", opacity: 0.6 }}>
                  Нет данных для отображения
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
