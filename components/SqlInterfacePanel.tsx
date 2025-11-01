import React, { useState } from "react";

export default function SqlInterfacePanel() {
  const [selectedTable, setSelectedTable] = useState("");
  const [tables] = useState(["users", "orders", "products"]); // временный список

  const handleExecute = () => {
    alert(`Выполняем запрос для таблицы: ${selectedTable}`);
  };

  return (
    <div className="p-6 bg-white rounded-2xl shadow-md w-full max-w-5xl mx-auto">
      <h2 className="text-2xl font-semibold mb-4 text-gray-800">
        SQL Interface Panel
      </h2>

      <div className="flex items-center gap-4 mb-6">
        <select
          className="border border-gray-300 rounded-lg p-2 w-64"
          value={selectedTable}
          onChange={(e) => setSelectedTable(e.target.value)}
        >
          <option value="">Выберите таблицу</option>
          {tables.map((table) => (
            <option key={table} value={table}>
              {table}
            </option>
          ))}
        </select>

        <button
          onClick={handleExecute}
          disabled={!selectedTable}
          className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 disabled:bg-gray-400"
        >
          Выполнить
        </button>
      </div>

      <p className="text-gray-600">
        Здесь позже появятся фильтры, колонки и результаты.
      </p>
    </div>
  );
}
