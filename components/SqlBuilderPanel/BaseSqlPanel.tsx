import React, { useState, useEffect } from "react";
import SqlDialectSelect from "@/components/SqlDialectSelect";
import { Button } from "../ui/button";
import { PanelWrapper } from "../ui/PanelWrapper"; // обёртка для единообразия

export default function BaseSqlPanel({
  schema,
  selectedTable,
  setSelectedTable,
  onChange,
  onExecute,
}: any) {
  const [dbType, setDbType] = useState("postgres");
  const [queryType, setQueryType] = useState("SELECT");
  const [fields, setFields] = useState<string[]>([]);
  const [joins, setJoins] = useState<any[]>([]);
  const [filters, setFilters] = useState<any[]>([]);
  const [orderBy, setOrderBy] = useState<any[]>([]);
  const [limit, setLimit] = useState<number>(100);
  const [offset, setOffset] = useState<number>(0);
  const [safeMode, setSafeMode] = useState<boolean>(true);

  useEffect(() => {
    onChange({
      dbType,
      queryType,
      table: selectedTable,
      fields,
      joins,
      filters,
      orderBy,
      limit,
      offset,
      transactionMode: safeMode,
    });
  }, [dbType, queryType, selectedTable, fields, joins, filters, orderBy, limit, offset, safeMode]);

  return (
    <PanelWrapper title="🧩 SQL Конструктор — Основные операции">
      {/* Тип БД */}
      <div className="input-group">
        <label>Тип базы данных</label>
        <SqlDialectSelect value={dbType} onChange={setDbType} />
      </div>

      {/* Тип SQL-запроса */}
      <div className="input-group">
        <label>Тип SQL-запроса</label>
        <select
          value={queryType}
          onChange={(e) => setQueryType(e.target.value)}
          className="sql-input"
        >
          {["SELECT", "INSERT", "UPDATE", "DELETE"].map((type) => (
            <option key={type}>{type}</option>
          ))}
        </select>
      </div>

      {/* Таблица */}
      <div className="input-group">
        <label>Таблица</label>
        <select
          value={selectedTable}
          onChange={(e) => setSelectedTable(e.target.value)}
          className="sql-input"
        >
          <option value="">— выбери таблицу —</option>
          {schema &&
            Object.keys(schema).map((table) => (
              <option key={table} value={table}>
                {table}
              </option>
            ))}
        </select>
      </div>

      {/* JOIN */}
      <div className="input-group">
        <label>Объединения (JOIN)</label>
        {joins.map((join, i) => (
          <div key={i} className="flex gap-2 items-center mb-1">
            <input
              type="text"
              placeholder="JOIN таблица ON ..."
              value={join.condition}
              onChange={(e) => {
                const updated = [...joins];
                updated[i].condition = e.target.value;
                setJoins(updated);
              }}
              className="sql-input flex-1"
            />
            <button
              className="delete-field-btn"
              onClick={() => setJoins(joins.filter((_, idx) => idx !== i))}
            >
              ✖
            </button>
          </div>
        ))}
        <Button
          className="add-btn text-sm"
          onClick={() => setJoins([...joins, { condition: "" }])}
        >
          ➕ Добавить JOIN
        </Button>
      </div>

      {/* WHERE */}
      <div className="input-group">
        <label>WHERE Условия</label>
        {filters.map((f, i) => (
          <div key={i} className="flex gap-2 items-center mb-1">
            <input
              type="text"
              placeholder="Поле = Значение"
              value={f.condition}
              onChange={(e) => {
                const updated = [...filters];
                updated[i].condition = e.target.value;
                setFilters(updated);
              }}
              className="sql-input flex-1"
            />
            <button
              className="delete-field-btn"
              onClick={() => setFilters(filters.filter((_, idx) => idx !== i))}
            >
              ✖
            </button>
          </div>
        ))}
        <Button
          className="add-btn text-sm"
          onClick={() => setFilters([...filters, { condition: "" }])}
        >
          ➕ Добавить фильтр
        </Button>
      </div>

      {/* ORDER BY */}
      <div className="input-group">
        <label>ORDER BY</label>
        {orderBy.map((o, i) => (
          <div key={i} className="flex gap-2 items-center mb-1">
            <input
              type="text"
              placeholder="Поле ASC|DESC"
              value={o.field}
              onChange={(e) => {
                const updated = [...orderBy];
                updated[i].field = e.target.value;
                setOrderBy(updated);
              }}
              className="sql-input flex-1"
            />
            <button
              className="delete-field-btn"
              onClick={() => setOrderBy(orderBy.filter((_, idx) => idx !== i))}
            >
              ✖
            </button>
          </div>
        ))}
        <Button
          className="add-btn text-sm"
          onClick={() => setOrderBy([...orderBy, { field: "" }])}
        >
          ➕ Добавить сортировку
        </Button>
      </div>

      {/* LIMIT / OFFSET */}
      <div className="flex gap-4">
        <div className="input-group flex-1">
          <label>LIMIT</label>
          <input
            type="number"
            value={limit}
            onChange={(e) => setLimit(Number(e.target.value))}
            min={1}
            placeholder="100"
            className="sql-input"
          />
        </div>

        <div className="input-group flex-1">
          <label>OFFSET</label>
          <input
            type="number"
            value={offset}
            onChange={(e) => setOffset(Number(e.target.value))}
            min={0}
            placeholder="0"
            className="sql-input"
          />
        </div>
      </div>

      {/* Нижняя панель */}
      <div className="flex justify-between items-center mt-4 flex-wrap gap-3">
        <label className="flex items-center gap-2 cursor-pointer text-sm text-gray-200">
          <input
            type="checkbox"
            checked={safeMode}
            onChange={(e) => setSafeMode(e.target.checked)}
            className="distinct-checkbox"
          />
          🔒 Безопасное выполнение
        </label>

        <div className="flex gap-2 justify-end">
          <Button variant="ghost" className="add-btn show-sql text-sm">
            📄 Показать SQL
          </Button>
          <Button
            onClick={onExecute}
            variant="primary"
            className="execute-btn text-sm"
          >
            ⚡ Выполнить SQL
          </Button>
        </div>
      </div>
    </PanelWrapper>
  );
}
