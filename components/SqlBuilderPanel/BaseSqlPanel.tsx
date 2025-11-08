import React, { useState, useEffect } from "react";
import { Button } from "../ui/button";

interface SqlFilter {
  field: string;
  op: string;
  value: string;
}

interface SqlOrder {
  field: string;
  direction: "ASC" | "DESC";
}

interface SqlBuilderProps {
  onExecute: (query: any) => void;
  schema?: Record<string, string[]>; // схема таблиц (для дропдаунов)
  selectedTable?: string;
  setSelectedTable?: React.Dispatch<React.SetStateAction<string>>;
  onChange?: (val: any) => void;
}

export default function BaseSqlPanel({
  onExecute,
  schema,
  selectedTable,
  setSelectedTable,
  onChange,
}: SqlBuilderProps) {
  const [dbType, setDbType] = useState("postgres");
  const [queryType, setQueryType] = useState("SELECT");
  const [table, setTable] = useState(selectedTable || "");
  const [fields, setFields] = useState<string[]>(["*"]);
  const [filters, setFilters] = useState<SqlFilter[]>([]);
  const [orderBy, setOrderBy] = useState<SqlOrder[]>([]);
  const [limit, setLimit] = useState("");
  const [offset, setOffset] = useState("");
  const [transactionMode, setTransactionMode] = useState(false);

  useEffect(() => {
    if (onChange) {
      onChange({
        dbType,
        queryType,
        table,
        fields,
        filters,
        orderBy,
        limit,
        offset,
        transactionMode,
      });
    }
  }, [
    dbType,
    queryType,
    table,
    fields,
    filters,
    orderBy,
    limit,
    offset,
    transactionMode,
  ]);

  const handleExecute = () => {
    const query = {
      dbType,
      queryType,
      table,
      fields,
      filters,
      orderBy,
      limit,
      offset,
      transactionMode,
    };
    onExecute(query);
  };

  return (
    <div className="sql-builder-panel">
      <h2 className="panel-title">🧠 SQL Конструктор — Основные операции</h2>

      {/* Тип БД и тип SQL-запроса */}
      <div className="builder-grid">
        <div className="input-group">
          <label>Тип базы данных</label>
          <select value={dbType} onChange={(e) => setDbType(e.target.value)}>
            <option value="postgres">PostgreSQL</option>
            <option value="mysql">MySQL</option>
            <option value="mssql">MS SQL</option>
            <option value="sqlite">SQLite</option>
            <option value="oracle">Oracle</option>
            <option value="mariadb">MariaDB</option>
            <option value="clickhouse">ClickHouse</option>
          </select>
        </div>

        <div className="input-group">
          <label>Тип SQL-запроса</label>
          <select
            value={queryType}
            onChange={(e) => setQueryType(e.target.value)}
          >
            <option>SELECT</option>
            <option>INSERT</option>
            <option>UPDATE</option>
            <option>DELETE</option>
          </select>
        </div>
      </div>

      {/* Таблица */}
      <div className="input-group">
        <label>Таблица</label>
        <select
          value={table}
          onChange={(e) => {
            setTable(e.target.value);
            if (setSelectedTable) setSelectedTable(e.target.value);
          }}
        >
          <option value="">— выбери таблицу —</option>
          {schema &&
            Object.keys(schema).map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
        </select>
      </div>

      {/* Поля */}
      <div className="input-group">
        <label>Поля</label>
        {fields.map((f, i) => (
          <div key={i} className="field-row">
            <select
              value={f}
              onChange={(e) => {
                const updated = [...fields];
                updated[i] = e.target.value;
                setFields(updated);
              }}
            >
              <option value="">— выбрать —</option>
              {schema &&
                table &&
                schema[table]?.map((col) => (
                  <option key={col} value={col}>
                    {col}
                  </option>
                ))}
            </select>
            <button
              onClick={() => setFields(fields.filter((_, idx) => idx !== i))}
              className="delete-field-btn"
            >
              ✖
            </button>
          </div>
        ))}
        <button
          onClick={() => setFields([...fields, ""])}
          className="add-btn"
        >
          ➕ Добавить поле
        </button>
      </div>

      {/* WHERE */}
      <div className="input-group">
        <label>WHERE Условия</label>
        {filters.map((f, i) => (
          <div key={i} className="field-row">
            <select
              value={f.field}
              onChange={(e) => {
                const updated = [...filters];
                updated[i].field = e.target.value;
                setFilters(updated);
              }}
            >
              <option value="">— поле —</option>
              {schema &&
                table &&
                schema[table]?.map((col) => (
                  <option key={col} value={col}>
                    {col}
                  </option>
                ))}
            </select>
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
              <option>LIKE</option>
              <option>IN</option>
              <option>BETWEEN</option>
              <option>IS NULL</option>
              <option>IS NOT NULL</option>
            </select>
            <input
              value={f.value}
              onChange={(e) => {
                const updated = [...filters];
                updated[i].value = e.target.value;
                setFilters(updated);
              }}
              placeholder="Значение"
            />
            <button
              onClick={() => setFilters(filters.filter((_, idx) => idx !== i))}
              className="delete-field-btn"
            >
              ✖
            </button>
          </div>
        ))}
        <button
          onClick={() =>
            setFilters([...filters, { field: "", op: "=", value: "" }])
          }
          className="add-btn"
        >
          ➕ Добавить фильтр
        </button>
      </div>

      {/* ORDER BY */}
      <div className="input-group">
        <label>ORDER BY</label>
        {orderBy.map((o, i) => (
          <div key={i} className="field-row">
            <select
              value={o.field}
              onChange={(e) => {
                const updated = [...orderBy];
                updated[i].field = e.target.value;
                setOrderBy(updated);
              }}
            >
              <option value="">— поле —</option>
              {schema &&
                table &&
                schema[table]?.map((col) => (
                  <option key={col} value={col}>
                    {col}
                  </option>
                ))}
            </select>
            <select
              value={o.direction}
              onChange={(e) => {
                const updated = [...orderBy];
                updated[i].direction = e.target.value as "ASC" | "DESC";
                setOrderBy(updated);
              }}
            >
              <option>ASC</option>
              <option>DESC</option>
            </select>
            <button
              onClick={() => setOrderBy(orderBy.filter((_, idx) => idx !== i))}
              className="delete-field-btn"
            >
              ✖
            </button>
          </div>
        ))}
        <button
          onClick={() =>
            setOrderBy([...orderBy, { field: "", direction: "ASC" }])
          }
          className="add-btn"
        >
          ➕ Добавить сортировку
        </button>
      </div>

      {/* LIMIT/OFFSET */}
      <div className="builder-grid">
        <div className="input-group">
          <label>LIMIT</label>
          <input
            type="number"
            value={limit}
            onChange={(e) => setLimit(e.target.value)}
            placeholder="Например: 100"
          />
        </div>

        <div className="input-group">
          <label>OFFSET</label>
          <input
            type="number"
            value={offset}
            onChange={(e) => setOffset(e.target.value)}
            placeholder="Например: 0"
          />
        </div>
      </div>

      {/* Transaction toggle */}
      <div className="transaction-box">
        <label className="transaction-label">
          <input
            type="checkbox"
            checked={transactionMode}
            onChange={(e) => setTransactionMode(e.target.checked)}
          />
          <span style={{ marginLeft: "8px" }}>
            Включить транзакцию (BEGIN / COMMIT)
          </span>
        </label>
      </div>

      {/* Execute */}
      <div className="flex justify-end mt-4">
        <Button onClick={handleExecute} variant="primary">
          ⚡ Выполнить SQL
        </Button>
      </div>
    </div>
  );
}
