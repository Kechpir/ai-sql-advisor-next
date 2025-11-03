import React, { useState } from "react";
import { jsonToSql } from "../../utils/jsonToSql";

// Подключаем все подмодули
import ConnectionManager from "./ConnectionManager";
import QueryTypeSelector from "./QueryTypeSelector";
import FieldsSelector from "./FieldsSelector";
import JoinEditor from "./JoinEditor";
import FilterEditor from "./FilterEditor";
import GroupOrderSection from "./GroupOrderSection";

interface SqlBuilderPanelProps {
  onExecute?: (query: any) => void;
}

export default function SqlBuilderPanel({ onExecute }: SqlBuilderPanelProps) {
  // Основные состояния
  const [selectedDb, setSelectedDb] = useState<string>("default");
  const [dbType, setDbType] = useState<string>("postgres");
  const [queryType, setQueryType] = useState<string>("SELECT");
  const [table, setTable] = useState<string>("users");

  const [fields, setFields] = useState<string[]>(["id", "name", "email"]);
  const [aggregateFunctions, setAggregateFunctions] = useState<Record<string, string>>({});

  const [filters, setFilters] = useState<{ field: string; op: string; value: string }[]>([]);
  const [joins, setJoins] = useState<
    { type: "INNER" | "LEFT" | "RIGHT" | "FULL"; table: string; on: string }[]
  >([]);

  const [groupBy, setGroupBy] = useState<string[]>([]);
  const [orderBy, setOrderBy] = useState<{ field: string; direction: "ASC" | "DESC" }[]>([]);
  const [transaction, setTransaction] = useState<boolean>(false);

  const [generatedSQL, setGeneratedSQL] = useState<string>("");

  // Генерация SQL
  const handleGenerateSQL = () => {
    try {
      const processedFields = fields.map((f) => {
        const func = aggregateFunctions[f];
        return func ? `${func}(${f})` : f;
      });

      const jsonQuery = {
        database: selectedDb,
        dbType,
        queryType,
        table,
        fields: processedFields,
        filters,
        joins,
        groupBy,
        orderBy,
        transaction,
      };

      const sql = jsonToSql(jsonQuery);
      setGeneratedSQL(sql);

      if (onExecute) onExecute(jsonQuery);
    } catch (err) {
      setGeneratedSQL(`Ошибка: ${(err as Error).message}`);
    }
  };

  // Очистка панели
  const handleReset = () => {
    setFields(["id", "name", "email"]);
    setFilters([]);
    setJoins([]);
    setGroupBy([]);
    setOrderBy([]);
    setAggregateFunctions({});
    setGeneratedSQL("");
  };

  // Копирование SQL
  const handleCopy = () => {
    if (generatedSQL) {
      navigator.clipboard.writeText(generatedSQL);
      alert("✅ SQL скопирован в буфер обмена!");
    }
  };

  return (
    <div className="sql-builder-panel">
      {/* ============================ */}
      {/* 🧠 Верхняя панель */}
      {/* ============================ */}
      <div className="sql-header">
        <button onClick={() => alert("💾 Сохранение в разработке")}>💾 Сохранить</button>
        <button onClick={handleReset}>🧹 Очистить</button>
        <button onClick={handleCopy}>📤 Копировать SQL</button>
      </div>

      <h2 className="panel-title">🧠 Визуальный SQL Конструктор</h2>

      {/* ============================ */}
      {/* 🔗 Подключение к БД */}
      {/* ============================ */}
      <ConnectionManager
        selectedDb={selectedDb}
        setSelectedDb={setSelectedDb}
        dbType={dbType}
        setDbType={setDbType}
      />

      {/* ============================ */}
      {/* ⚙️ Тип запроса */}
      {/* ============================ */}
      <QueryTypeSelector queryType={queryType} setQueryType={setQueryType} />

      {/* ============================ */}
      {/* 🧩 Таблица */}
      {/* ============================ */}
      <div className="input-group">
        <label>Таблица:</label>
        <input
          type="text"
          value={table}
          onChange={(e) => setTable(e.target.value)}
          placeholder="users / orders / products"
        />
      </div>

      {/* ============================ */}
      {/* 📋 Поля и агрегатные функции */}
      {/* ============================ */}
      <FieldsSelector
        fields={fields}
        setFields={setFields}
        aggregateFunctions={aggregateFunctions}
        setAggregateFunctions={setAggregateFunctions}
      />

      {/* ============================ */}
      {/* 🔗 JOIN */}
      {/* ============================ */}
      <JoinEditor joins={joins} setJoins={setJoins} />

      {/* ============================ */}
      {/* 🔍 WHERE фильтры */}
      {/* ============================ */}
      <FilterEditor filters={filters} setFilters={setFilters} />

      {/* ============================ */}
      {/* 📊 GROUP и ORDER BY */}
      {/* ============================ */}
      <GroupOrderSection
        groupBy={groupBy}
        setGroupBy={setGroupBy}
        orderBy={orderBy}
        setOrderBy={setOrderBy}
      />

      {/* ============================ */}
      {/* 🔒 Транзакция */}
      {/* ============================ */}
      <div className="input-group checkbox">
        <label>
          <input
            type="checkbox"
            checked={transaction}
            onChange={(e) => setTransaction(e.target.checked)}
          />
          Использовать транзакцию (BEGIN / COMMIT)
        </label>
      </div>

      {/* ============================ */}
      {/* ⚡ Кнопка генерации */}
      {/* ============================ */}
      <div className="action-group">
        <button onClick={handleGenerateSQL}>⚡ Сгенерировать SQL</button>
      </div>

      {/* ============================ */}
      {/* 🧾 Вывод результата */}
      {/* ============================ */}
      <div className="sql-output">
        <h3>🧾 Сгенерированный SQL:</h3>
        <pre>{generatedSQL || "-- Здесь появится готовый SQL-запрос --"}</pre>
      </div>
    </div>
  );
}
