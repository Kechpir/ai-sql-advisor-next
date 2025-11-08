import React from "react";

interface QueryTypeSelectorProps {
  queryType: string;
  setQueryType: (value: string) => void;
}

export default function QueryTypeSelector({
  queryType,
  setQueryType,
}: QueryTypeSelectorProps) {
  return (
    <div className="input-group query-type-selector">
      <label>Тип SQL-запроса:</label>
      <select
        value={queryType}
        onChange={(e) => setQueryType(e.target.value)}
        className="query-type-dropdown"
      >
        <option value="SELECT">SELECT (Выборка данных)</option>
        <option value="INSERT">INSERT (Добавление данных)</option>
        <option value="UPDATE">UPDATE (Изменение данных)</option>
        <option value="DELETE">DELETE (Удаление данных)</option>
        <option value="ALTER">ALTER (Изменение структуры)</option>
        <option value="CREATE">CREATE (Создание таблицы)</option>
        <option value="DROP">DROP (Удаление таблицы)</option>
      </select>

      <div className="query-type-hint">
        {queryType === "SELECT" && <p>🔍 Выполнит выборку данных из указанной таблицы.</p>}
        {queryType === "INSERT" && <p>🟢 Добавит новые записи в таблицу.</p>}
        {queryType === "UPDATE" && <p>📝 Изменит существующие данные.</p>}
        {queryType === "DELETE" && <p>❌ Удалит записи из таблицы.</p>}
        {queryType === "ALTER" && <p>🧱 Изменит структуру таблицы (например, добавит поле).</p>}
        {queryType === "CREATE" && <p>📦 Создаст новую таблицу в базе данных.</p>}
        {queryType === "DROP" && <p>⚠️ Удалит таблицу полностью (осторожно!).</p>}
      </div>
    </div>
  );
}
