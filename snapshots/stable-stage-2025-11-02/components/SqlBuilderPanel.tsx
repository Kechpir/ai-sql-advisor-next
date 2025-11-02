import React, { useState } from "react";

export default function SqlBuilderPanel({ onRunQuery }: { onRunQuery?: (query: any) => void }) {
  // 📦 Mock данные — позже заменим на реальные из схемы
  const tables = ["users", "orders", "products", "transactions"];

  const fieldsByTable: Record<string, string[]> = {
    users: ["id", "name", "email", "country", "created_at"],
    orders: ["id", "user_id", "total", "status", "created_at"],
    products: ["id", "name", "category", "price", "stock"],
    transactions: ["id", "order_id", "amount", "method", "date"],
  };

  const aggregateFunctions = ["COUNT", "SUM", "AVG", "MIN", "MAX"];

  // 🧠 Состояния
  const [selectedTable, setSelectedTable] = useState<string>("");
  const [selectedFields, setSelectedFields] = useState<string[]>([]);
  const [filters, setFilters] = useState<{ field: string; op: string; value: string }[]>([]);
  const [orderBy, setOrderBy] = useState<{ field: string; direction: "ASC" | "DESC" }[]>([]);
  const [groupBy, setGroupBy] = useState<string[]>([]);
  const [aggregates, setAggregates] = useState<{ func: string; field: string; alias: string }[]>([]);
  const [transactionMode, setTransactionMode] = useState<boolean>(false);

  // 🧩 Добавление фильтра
  const addFilter = () => {
    setFilters([...filters, { field: "", op: "=", value: "" }]);
  };

  // 🧩 Добавление сортировки
  const addOrder = () => {
    setOrderBy([...orderBy, { field: "", direction: "ASC" }]);
  };

  // 🧩 Добавление агрегата
  const addAggregate = () => {
    setAggregates([...aggregates, { func: "COUNT", field: "", alias: "" }]);
  };

  // 🧩 Сброс конструктора
  const clearAll = () => {
    setSelectedTable("");
    setSelectedFields([]);
    setFilters([]);
    setOrderBy([]);
    setGroupBy([]);
    setAggregates([]);
    setTransactionMode(false);
  };

  // 🚀 Сборка финального JSON-запроса
  const buildQuery = () => {
    const query = {
      table: selectedTable,
      fields: selectedFields,
      filters,
      orderBy,
      groupBy,
      aggregates,
      transaction: transactionMode,
    };
    console.log("Built Query:", query);
    if (onRunQuery) onRunQuery(query);
  };

  return (
    <div className="sql-builder-panel">
      <h2 className="panel-title">🧠 Визуальный SQL Конструктор</h2>

      {/* Выбор таблицы */}
      <div className="builder-section">
        <label>📋 Таблица:</label>
        <select value={selectedTable} onChange={(e) => setSelectedTable(e.target.value)}>
          <option value="">Выберите таблицу</option>
          {tables.map((tbl) => (
            <option key={tbl} value={tbl}>
              {tbl}
            </option>
          ))}
        </select>
      </div>

      {/* Поля */}
      {selectedTable && (
        <div className="builder-section">
          <label>🧩 Поля:</label>
          <div className="fields-grid">
            {fieldsByTable[selectedTable].map((field) => (
              <label key={field} className="field-checkbox">
                <input
                  type="checkbox"
                  checked={selectedFields.includes(field)}
                  onChange={(e) =>
                    setSelectedFields((prev) =>
                      e.target.checked ? [...prev, field] : prev.filter((f) => f !== field)
                    )
                  }
                />
                {field}
              </label>
            ))}
          </div>
        </div>
      )}

      {/* WHERE */}
      {selectedTable && (
        <div className="builder-section">
          <label>🔍 Фильтры (WHERE):</label>
          {filters.map((f, i) => (
            <div key={i} className="filter-row">
              <select
                value={f.field}
                onChange={(e) => {
                  const newFilters = [...filters];
                  newFilters[i].field = e.target.value;
                  setFilters(newFilters);
                }}
              >
                <option value="">Поле</option>
                {fieldsByTable[selectedTable].map((fld) => (
                  <option key={fld} value={fld}>
                    {fld}
                  </option>
                ))}
              </select>
              <select
                value={f.op}
                onChange={(e) => {
                  const newFilters = [...filters];
                  newFilters[i].op = e.target.value;
                  setFilters(newFilters);
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
                  const newFilters = [...filters];
                  newFilters[i].value = e.target.value;
                  setFilters(newFilters);
                }}
              />
            </div>
          ))}
          <button onClick={addFilter} className="small-btn">
            ➕ Добавить фильтр
          </button>
        </div>
      )}

      {/* ORDER BY */}
      {selectedTable && (
        <div className="builder-section">
          <label>⬆️ Сортировка (ORDER BY):</label>
          {orderBy.map((o, i) => (
            <div key={i} className="order-row">
              <select
                value={o.field}
                onChange={(e) => {
                  const newOrder = [...orderBy];
                  newOrder[i].field = e.target.value;
                  setOrderBy(newOrder);
                }}
              >
                <option value="">Поле</option>
                {fieldsByTable[selectedTable].map((fld) => (
                  <option key={fld} value={fld}>
                    {fld}
                  </option>
                ))}
              </select>
              <select
                value={o.direction}
                onChange={(e) => {
                  const newOrder = [...orderBy];
                  newOrder[i].direction = e.target.value as "ASC" | "DESC";
                  setOrderBy(newOrder);
                }}
              >
                <option value="ASC">ASC</option>
                <option value="DESC">DESC</option>
              </select>
            </div>
          ))}
          <button onClick={addOrder} className="small-btn">
            ➕ Добавить сортировку
          </button>
        </div>
      )}

      {/* GROUP BY */}
      {selectedTable && (
        <div className="builder-section">
          <label>📊 Группировка (GROUP BY):</label>
          <div className="fields-grid">
            {fieldsByTable[selectedTable].map((fld) => (
              <label key={fld} className="field-checkbox">
                <input
                  type="checkbox"
                  checked={groupBy.includes(fld)}
                  onChange={(e) =>
                    setGroupBy((prev) =>
                      e.target.checked ? [...prev, fld] : prev.filter((f) => f !== fld)
                    )
                  }
                />
                {fld}
              </label>
            ))}
          </div>
        </div>
      )}

      {/* Агрегаты */}
      {selectedTable && (
        <div className="builder-section">
          <label>🧮 Агрегатные функции:</label>
          {aggregates.map((agg, i) => (
            <div key={i} className="aggregate-row">
              <select
                value={agg.func}
                onChange={(e) => {
                  const newAggs = [...aggregates];
                  newAggs[i].func = e.target.value;
                  setAggregates(newAggs);
                }}
              >
                {aggregateFunctions.map((fn) => (
                  <option key={fn}>{fn}</option>
                ))}
              </select>
              <select
                value={agg.field}
                onChange={(e) => {
                  const newAggs = [...aggregates];
                  newAggs[i].field = e.target.value;
                  setAggregates(newAggs);
                }}
              >
                <option value="">Поле</option>
                {fieldsByTable[selectedTable].map((fld) => (
                  <option key={fld}>{fld}</option>
                ))}
              </select>
              <input
                type="text"
                placeholder="Псевдоним (AS)"
                value={agg.alias}
                onChange={(e) => {
                  const newAggs = [...aggregates];
                  newAggs[i].alias = e.target.value;
                  setAggregates(newAggs);
                }}
              />
            </div>
          ))}
          <button onClick={addAggregate} className="small-btn">
            ➕ Добавить агрегат
          </button>
        </div>
      )}

      {/* TRANSACTION */}
      <div className="builder-section">
        <label>
          <input
            type="checkbox"
            checked={transactionMode}
            onChange={() => setTransactionMode(!transactionMode)}
          />{" "}
          ⚙️ Использовать транзакцию (BEGIN / COMMIT / ROLLBACK)
        </label>
      </div>

      {/* Кнопки действий */}
      <div className="actions-row">
        <button onClick={buildQuery} className="run-btn">
          ▶️ Выполнить
        </button>
        <button onClick={clearAll} className="clear-btn">
          🧹 Очистить
        </button>
        <button className="save-btn">💾 Сохранить</button>
      </div>
    </div>
  );
}
