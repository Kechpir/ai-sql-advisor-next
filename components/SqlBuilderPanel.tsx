import React, { useState } from "react";
import { jsonToSql } from "../utils/jsonToSql";

interface SqlBuilderPanelProps {
  onExecute?: (query: any) => void;
}

export default function SqlBuilderPanel({ onExecute }: SqlBuilderPanelProps) {
  const [table, setTable] = useState("users");
  const [fields, setFields] = useState<string[]>(["id", "name", "email"]);
  const [filters, setFilters] = useState<{ field: string; op: string; value: string }[]>([]);
  const [orderBy, setOrderBy] = useState<{ field: string; direction: "ASC" | "DESC" }[]>([]);
  const [groupBy, setGroupBy] = useState<string[]>([]);
  const [joins, setJoins] = useState<
    { type: "INNER" | "LEFT" | "RIGHT" | "FULL"; table: string; on: string }[]
  >([]);
  const [transaction, setTransaction] = useState(false);
  const [generatedSQL, setGeneratedSQL] = useState("");
  const [savedQueries, setSavedQueries] = useState<string[]>([]);
  const [lastQuery, setLastQuery] = useState<any | null>(null);

  const handleAddFilter = () => setFilters([...filters, { field: "", op: "=", value: "" }]);
  const handleAddOrder = () => setOrderBy([...orderBy, { field: "", direction: "ASC" }]);
  const handleAddJoin = () => setJoins([...joins, { type: "INNER", table: "", on: "" }]);

  const handleGenerateSQL = () => {
    try {
      const jsonQuery = {
        table,
        fields,
        filters,
        orderBy,
        groupBy,
        joins,
        transaction,
      };

      const sql = jsonToSql(jsonQuery);
      setGeneratedSQL(sql);
      setLastQuery(jsonQuery);

      if (onExecute) onExecute(jsonQuery);
    } catch (err) {
      setGeneratedSQL(`Ошибка: ${(err as Error).message}`);
    }
  };

  // 💾 Сохранение запроса в localStorage
  const handleSaveQuery = () => {
    if (!generatedSQL) return alert("Нет SQL для сохранения");
    const updated = [...savedQueries, generatedSQL];
    setSavedQueries(updated);
    localStorage.setItem("savedQueries", JSON.stringify(updated));
    alert("✅ Запрос сохранён");
  };

  // 🧹 Очистка формы
  const handleClear = () => {
    setFields([]);
    setFilters([]);
    setOrderBy([]);
    setGroupBy([]);
    setJoins([]);
    setGeneratedSQL("");
    setTransaction(false);
  };

  // 📤 Экспорт SQL (в .sql файл)
  const handleExportSQL = () => {
    if (!generatedSQL) return alert("Нет SQL для экспорта");
    const blob = new Blob([generatedSQL], { type: "text/sql" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `query_${table}.sql`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // 🔁 Повторить последний запрос
  const handleRepeatLast = () => {
    if (!lastQuery) return alert("Нет последнего запроса");
    if (onExecute) onExecute(lastQuery);
  };

  return (
    <div className="sql-builder-panel">
      {/* === 🔝 Верхняя панель управления === */}
      <div className="sql-header">
        <button onClick={handleSaveQuery}>💾 Сохранить</button>
        <button onClick={handleClear}>🧹 Очистить</button>
        <button onClick={handleExportSQL}>📤 Экспорт SQL</button>
        <button onClick={handleRepeatLast}>🔁 Повторить</button>
      </div>

      <h2 className="panel-title">🧠 Визуальный SQL Конструктор</h2>

      {/* Таблица */}
      <div className="input-group">
        <label>Таблица:</label>
        <select value={table} onChange={(e) => setTable(e.target.value)}>
          <option value="users">users</option>
          <option value="orders">orders</option>
          <option value="products">products</option>
        </select>
      </div>

      {/* Поля */}
      <div className="input-group">
        <label>Поля SELECT:</label>
        <input
          type="text"
          value={fields.join(", ")}
          onChange={(e) => setFields(e.target.value.split(",").map((f) => f.trim()))}
          placeholder="id, name, email"
        />
      </div>

      {/* Фильтры */}
      <div className="filters-section">
        <label>Фильтры (WHERE):</label>
        {filters.map((f, i) => (
          <div key={i} className="filter-row">
            <input
              type="text"
              placeholder="Поле"
              value={f.field}
              onChange={(e) => {
                const updated = [...filters];
                updated[i].field = e.target.value;
                setFilters(updated);
              }}
            />
            <select
              value={f.op}
              onChange={(e) => {
                const updated = [...filters];
                updated[i].op = e.target.value;
                setFilters(updated);
              }}
            >
              <option>=</option>
              <option>!=</option>
              <option>&gt;</option>
              <option>&lt;</option>
              <option>&gt;=</option>
              <option>&lt;=</option>
              <option>LIKE</option>
            </select>
            <input
              type="text"
              placeholder="Значение"
              value={f.value}
              onChange={(e) => {
                const updated = [...filters];
                updated[i].value = e.target.value;
                setFilters(updated);
              }}
            />
          </div>
        ))}
        <button onClick={handleAddFilter}>➕ Добавить фильтр</button>
      </div>

      {/* Сортировки */}
      <div className="order-section">
        <label>Сортировка (ORDER BY):</label>
        {orderBy.map((o, i) => (
          <div key={i} className="order-row">
            <input
              type="text"
              placeholder="Поле"
              value={o.field}
              onChange={(e) => {
                const updated = [...orderBy];
                updated[i].field = e.target.value;
                setOrderBy(updated);
              }}
            />
            <select
              value={o.direction}
              onChange={(e) => {
                const updated = [...orderBy];
                updated[i].direction = e.target.value as "ASC" | "DESC";
                setOrderBy(updated);
              }}
            >
              <option value="ASC">ASC</option>
              <option value="DESC">DESC</option>
            </select>
          </div>
        ))}
        <button onClick={handleAddOrder}>➕ Добавить сортировку</button>
      </div>

      {/* JOIN */}
      <div className="join-section">
        <label>Объединения (JOIN):</label>
        {joins.map((j, i) => (
          <div key={i} className="join-row">
            <select
              value={j.type}
              onChange={(e) => {
                const updated = [...joins];
                updated[i].type = e.target.value as "INNER" | "LEFT" | "RIGHT" | "FULL";
                setJoins(updated);
              }}
            >
              <option value="INNER">INNER</option>
              <option value="LEFT">LEFT</option>
              <option value="RIGHT">RIGHT</option>
              <option value="FULL">FULL</option>
            </select>
            <input
              type="text"
              placeholder="Таблица"
              value={j.table}
              onChange={(e) => {
                const updated = [...joins];
                updated[i].table = e.target.value;
                setJoins(updated);
              }}
            />
            <input
              type="text"
              placeholder="ON условие (пример: users.id = orders.user_id)"
              value={j.on}
              onChange={(e) => {
                const updated = [...joins];
                updated[i].on = e.target.value;
                setJoins(updated);
              }}
            />
          </div>
        ))}
        <button onClick={handleAddJoin}>➕ Добавить JOIN</button>
      </div>

      {/* GROUP BY */}
      <div className="input-group">
        <label>Группировка (GROUP BY):</label>
        <input
          type="text"
          placeholder="name, country"
          value={groupBy.join(", ")}
          onChange={(e) => setGroupBy(e.target.value.split(",").map((v) => v.trim()))}
        />
      </div>

      {/* Транзакция */}
      <div className="input-group checkbox">
        <label>
          <input
            type="checkbox"
            checked={transaction}
            onChange={(e) => setTransaction(e.target.checked)}
          />
          Использовать транзакцию (BEGIN/COMMIT)
        </label>
      </div>

      {/* Кнопка */}
      <div className="action-group">
        <button onClick={handleGenerateSQL}>⚡ Выполнить / Сгенерировать SQL</button>
      </div>

      {/* Результат */}
      <div className="sql-output">
        <h3>🧾 Сгенерированный SQL:</h3>
        <pre>{generatedSQL}</pre>
      </div>
    </div>
  );
}
