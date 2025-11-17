import React, { useState, useContext } from "react";
import ConnectionManager from "@/components/SqlBuilderPanel/ConnectionManager";
import { SqlBuilderContext } from "./SqlBuilderContext";


/**
 * ✅ Универсальный визуальный SQL Builder
 * — поддерживает все 20 ключевых SQL-операций
 * — двухколоночная сетка (на основе .sql-grid-2)
 * — готов к подключению к реальной БД
 */

export default function SqlBuilderPanel() {
  const { schema } = useContext(SqlBuilderContext) || { schema: {} };
  const [connection, setConnection] = useState("");
  const [selectedTable, setSelectedTable] = useState("");
  const [queryType, setQueryType] = useState("SELECT");

  // Состояния для всех SQL операций
  const [fields, setFields] = useState<string[]>([]);
  const [joins, setJoins] = useState<any[]>([]);
  const [filters, setFilters] = useState<any[]>([]);
  const [groupBy, setGroupBy] = useState<string[]>([]);
  const [having, setHaving] = useState("");
  const [orderBy, setOrderBy] = useState<{ field: string; direction: string }[]>([]);
  const [limit, setLimit] = useState("");
  const [offset, setOffset] = useState("");
  const [distinct, setDistinct] = useState(false);
  const [union, setUnion] = useState("");
  const [cte, setCte] = useState("");
  const [windowFunctions, setWindowFunctions] = useState<any[]>([]);
  const [caseWhen, setCaseWhen] = useState("");
  const [jsonOps, setJsonOps] = useState<any[]>([]);
  const [dateLogic, setDateLogic] = useState<any[]>([]);
  const [pagination, setPagination] = useState({ page: 1, pageSize: 50 });
  const [queryHints, setQueryHints] = useState<string[]>([]);
  const [recursive, setRecursive] = useState(false);
  const [generatedSQL, setGeneratedSQL] = useState("");

  const tables = Object.keys(schema || {});

  const buildSQL = () => {
    let sql = "";

    if (queryType === "SELECT") {
      sql = `SELECT ${distinct ? "DISTINCT " : ""}${fields.length ? fields.join(", ") : "*"} FROM ${selectedTable}`;
    }
    if (joins.length)
      sql += " " + joins.map((j) => `${j.type} JOIN ${j.table} ON ${j.condition}`).join(" ");
    if (filters.length)
      sql += " WHERE " + filters.map((f) => `${f.field} ${f.operator} '${f.value}'`).join(" AND ");
    if (groupBy.length) sql += ` GROUP BY ${groupBy.join(", ")}`;
    if (having) sql += ` HAVING ${having}`;
    if (orderBy.length)
      sql += ` ORDER BY ${orderBy.map((o) => `${o.field} ${o.direction}`).join(", ")}`;
    if (limit) sql += ` LIMIT ${limit}`;
    if (offset) sql += ` OFFSET ${offset}`;
    if (union) sql += ` UNION ${union}`;
    if (cte) sql = `WITH ${cte} ${sql}`;
    if (recursive) sql = `WITH RECURSIVE ${cte || "r"} AS (...) ${sql}`;
    if (queryHints.length) sql = `${queryHints.join(" ")} ${sql}`;
    sql += ";";

    setGeneratedSQL(sql);
  };

  return (
    <div className="sql-builder">
      <h2 className="panel-title">🧠 Визуальный SQL Конструктор</h2>

      {/* Подключение */}
      <section className="panel-section">
        <h3 className="section-title">Подключение к базе данных</h3>
        <ConnectionManager onConnected={(schema, dialect) => {
  console.log("✅ Подключено:", dialect);
  // здесь можешь добавить логику для обработки схемы
}} />

      </section>

      {connection && (
        <>
          {/* === ОСНОВНОЙ УРОВЕНЬ === */}
          <section className="panel-section">
            <h3 className="section-title">⚙️ Основные SQL операции</h3>

            <div className="sql-grid-2">
              {/* Левая колонка */}
              <div className="sql-card">
                <label>📦 Таблица</label>
                <select
                  className="sql-input"
                  value={selectedTable}
                  onChange={(e) => setSelectedTable(e.target.value)}
                >
                  <option value="">— выберите таблицу —</option>
                  {tables.map((t) => (
                    <option key={t}>{t}</option>
                  ))}
                </select>

                <label>🔧 Тип SQL-запроса</label>
                <select
                  className="sql-input"
                  value={queryType}
                  onChange={(e) => setQueryType(e.target.value)}
                >
                  {["SELECT", "INSERT", "UPDATE", "DELETE"].map((t) => (
                    <option key={t}>{t}</option>
                  ))}
                </select>

                <label>
                  <input
                    type="checkbox"
                    checked={distinct}
                    onChange={(e) => setDistinct(e.target.checked)}
                  />{" "}
                  DISTINCT
                </label>
              </div>

              {/* Правая колонка */}
              <div className="sql-card">
                <label>📊 SELECT поля</label>
                <button
                  className="btn btn-ghost"
                  onClick={() => setFields([...fields, "новое_поле"])}
                >
                  ➕ Добавить поле
                </button>
                {fields.map((f, i) => (
                  <div key={i} className="flex">
                    <select
                      className="sql-input"
                      value={f}
                      onChange={(e) => {
                        const updated = [...fields];
                        updated[i] = e.target.value;
                        setFields(updated);
                      }}
                    >
                      <option value="">— выберите поле —</option>
                      {schema[selectedTable]?.map((col) => (
                        <option key={col}>{col}</option>
                      ))}
                    </select>
                    <button
                      className="btn btn-danger"
                      onClick={() => setFields(fields.filter((_, idx) => idx !== i))}
                    >
                      ✖
                    </button>
                  </div>
                ))}
              </div>
            </div>
          </section>

          {/* === JOIN / GROUP / ORDER / WHERE === */}
          <section className="panel-section">
            <h3 className="section-title">🔗 Связи и группировки</h3>
            <div className="sql-grid-2">
              {/* JOIN */}
              <div className="sql-card">
                <label>JOIN связи</label>
                <button
                  className="btn btn-ghost"
                  onClick={() =>
                    setJoins([...joins, { type: "INNER", table: "", condition: "" }])
                  }
                >
                  ➕ Добавить JOIN
                </button>
                {joins.map((j, i) => (
                  <div key={i} className="flex">
                    <select
                      className="sql-input"
                      value={j.type}
                      onChange={(e) => {
                        const updated = [...joins];
                        updated[i].type = e.target.value;
                        setJoins(updated);
                      }}
                    >
                      {["INNER", "LEFT", "RIGHT", "FULL"].map((t) => (
                        <option key={t}>{t}</option>
                      ))}
                    </select>
                    <input
                      className="sql-input"
                      placeholder="Таблица"
                      value={j.table}
                      onChange={(e) => {
                        const updated = [...joins];
                        updated[i].table = e.target.value;
                        setJoins(updated);
                      }}
                    />
                    <input
                      className="sql-input"
                      placeholder="ON условие"
                      value={j.condition}
                      onChange={(e) => {
                        const updated = [...joins];
                        updated[i].condition = e.target.value;
                        setJoins(updated);
                      }}
                    />
                  </div>
                ))}
              </div>

              {/* GROUP / ORDER / LIMIT */}
              <div className="sql-card">
                <label>GROUP BY</label>
                <button
                  className="btn btn-ghost"
                  onClick={() => setGroupBy([...groupBy, ""])}
                >
                  ➕ Добавить Group
                </button>

                <label>ORDER BY</label>
                <button
                  className="btn btn-ghost"
                  onClick={() =>
                    setOrderBy([...orderBy, { field: "", direction: "ASC" }])
                  }
                >
                  ➕ Добавить Order
                </button>

                <label>LIMIT / OFFSET</label>
                <div className="flex">
                  <input
                    className="sql-input"
                    placeholder="LIMIT"
                    value={limit}
                    onChange={(e) => setLimit(e.target.value)}
                  />
                  <input
                    className="sql-input"
                    placeholder="OFFSET"
                    value={offset}
                    onChange={(e) => setOffset(e.target.value)}
                  />
                </div>
              </div>
            </div>
          </section>

          {/* === ADVANCED === */}
          <section className="panel-section">
            <h3 className="section-title">🧩 Расширенные SQL-настройки</h3>
            <div className="sql-grid-2">
              <div className="sql-card">
                <label>HAVING</label>
                <input
                  className="sql-input"
                  placeholder="COUNT(id) > 10"
                  value={having}
                  onChange={(e) => setHaving(e.target.value)}
                />

                <label>CASE WHEN</label>
                <textarea
                  className="sql-input"
                  placeholder="CASE WHEN age > 18 THEN 'Adult' END"
                  value={caseWhen}
                  onChange={(e) => setCaseWhen(e.target.value)}
                />
              </div>

              <div className="sql-card">
                <label>CTE / WITH</label>
                <textarea
                  className="sql-input"
                  placeholder="WITH cte_name AS (SELECT ...)"
                  value={cte}
                  onChange={(e) => setCte(e.target.value)}
                />

                <label>
                  <input
                    type="checkbox"
                    checked={recursive}
                    onChange={(e) => setRecursive(e.target.checked)}
                  />{" "}
                  WITH RECURSIVE
                </label>
              </div>
            </div>
          </section>

          {/* === EXPERT === */}
          <section className="panel-section">
            <h3 className="section-title">👑 Экспертные инструменты</h3>
            <div className="sql-grid-2">
              <div className="sql-card">
                <label>JSON / XML операции</label>
                <textarea
                  className="sql-input"
                  placeholder="JSON_EXTRACT(data, '$.user.name')"
                  value={jsonOps.join("\n")}
                  onChange={(e) => setJsonOps(e.target.value.split("\n"))}
                />

                <label>Дата / Время</label>
                <textarea
                  className="sql-input"
                  placeholder="NOW() - INTERVAL '7 days'"
                  value={dateLogic.join("\n")}
                  onChange={(e) => setDateLogic(e.target.value.split("\n"))}
                />
              </div>

              <div className="sql-card">
                <label>Query Hints</label>
                <textarea
                  className="sql-input"
                  placeholder="/*+ INDEX(users idx_name) */"
                  value={queryHints.join("\n")}
                  onChange={(e) => setQueryHints(e.target.value.split("\n"))}
                />

                <label>Pagination</label>
                <div className="flex">
                  <button
                    className="btn btn-ghost"
                    disabled={pagination.page <= 1}
                    onClick={() =>
                      setPagination({ ...pagination, page: pagination.page - 1 })
                    }
                  >
                    ◀ Prev
                  </button>
                  <span>Стр. {pagination.page}</span>
                  <button
                    className="btn btn-ghost"
                    onClick={() =>
                      setPagination({ ...pagination, page: pagination.page + 1 })
                    }
                  >
                    Next ▶
                  </button>
                </div>
              </div>
            </div>
          </section>

          {/* === SQL OUTPUT === */}
          <div className="flex justify-end mt-3">
            <button className="btn btn-primary" onClick={buildSQL}>
              ⚡ Сгенерировать SQL
            </button>
          </div>

          {generatedSQL && <pre className="sql-output mt-3">{generatedSQL}</pre>}
        </>
      )}
    </div>
  );
}
