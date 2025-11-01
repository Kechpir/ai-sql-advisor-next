import React, { useState } from "react";

/**
 * SQL Interface Panel — визуальная панель для работы с таблицами и SQL-запросами.
 * Сейчас это базовая версия с выбором таблицы, кнопкой "Выполнить"
 * и выводом тестовых данных. В следующих шагах сюда добавятся фильтры, API и Supabase.
 */

export default function SqlInterfacePanel() {
  const [selectedTable, setSelectedTable] = useState("");
  const [tables] = useState(["users", "orders", "products"]); // временный список таблиц
  const [data, setData] = useState<any[]>([]);

  // Обработчик кнопки "Выполнить"
  const handleExecute = () => {
    if (!selectedTable) return;

    // В будущем тут будет запрос к Supabase Edge Function.
    // Пока используем фейковые данные для демонстрации.
    const fakeData = [
      { id: 1, name: "Alice", email: "alice@example.com" },
      { id: 2, name: "Bob", email: "bob@example.com" },
      { id: 3, name: "Charlie", email: "charlie@example.com" },
    ];
    setData(fakeData);
  };

  return (
    <div className="p-6 bg-white rounded-2xl shadow-md w-full max-w-5xl mx-auto">
      {/* Заголовок */}
      <h2 className="text-2xl font-semibold mb-4 text-gray-800">
        SQL Interface Panel
      </h2>

      {/* Панель управления */}
      <div className="flex flex-wrap items-center gap-4 mb-6">
        <select
          className="border border-gray-300 rounded-lg p-2 w-64 focus:outline-none focus:ring-2 focus:ring-blue-400"
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
          className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 disabled:bg-gray-400 transition-all"
        >
          Выполнить
        </button>
      </div>

      {/* Результат выполнения */}
      {data.length > 0 && (
        <div className="overflow-x-auto mt-6">
          <table className="min-w-full border border-gray-200 text-sm">
            <thead>
              <tr className="bg-gray-100">
                {Object.keys(data[0]).map((key) => (
                  <th
                    key={key}
                    className="border-b border-gray-300 text-left px-4 py-2 text-gray-700 font-semibold"
                  >
                    {key}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {data.map((row, idx) => (
                <tr key={idx} className="hover:bg-gray-50 transition-colors">
                  {Object.values(row).map((value, i) => (
                    <td key={i} className="border-b px-4 py-2 text-gray-600">
                      {String(value)}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {data.length === 0 && (
        <p className="text-gray-500 mt-4">
          Результатов пока нет. Выберите таблицу и нажмите <b>«Выполнить»</b>.
        </p>
      )}
    </div>
  );
}
