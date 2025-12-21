import React, { useState } from "react";
import BaseSqlPanel from "./BaseSqlPanel";
import AdvancedSqlPanel from "./AdvancedSqlPanel";
import ExpertSqlPanel from "./ExpertSqlPanel";

/**
 * 🎛 SqlBuilderPanel — объединяет три уровня панелей
 * Base (основная логика), Advanced (группировки, JOIN, HAVING), Expert (CTE, JSON, Window)
 */

export default function SqlBuilderPanel({ schema, onChange }: any) {
  const [baseQuery, setBaseQuery] = useState({});
  const [advancedQuery, setAdvancedQuery] = useState({});
  const [expertQuery, setExpertQuery] = useState({});

  // обновляем родительский state при изменении любой панели
  const updateParent = (newData: any, type: "base" | "advanced" | "expert") => {
    const updated = {
      base: baseQuery,
      advanced: advancedQuery,
      expert: expertQuery,
      [type]: newData,
    };
    onChange(updated);
  };

  return (
    <div
      className="sql-builder-grid"
      style={{
        display: "grid",
        gridTemplateColumns: "repeat(auto-fit, minmax(420px, 1fr))",
        gap: "1.5rem",
        alignItems: "start",
        marginTop: "2rem",
      }}
    >
      {/* 🔹 Базовая панель */}
      <BaseSqlPanel
        schema={schema}
        onChange={(data: any) => {
          setBaseQuery(data);
          updateParent(data, "base");
        }}
      />

      {/* 🔸 Продвинутая панель */}
      <AdvancedSqlPanel
        schema={schema}
        onChange={(data: any) => {
          setAdvancedQuery(data);
          updateParent(data, "advanced");
        }}
      />

      {/* 🧬 Экспертная панель */}
      <ExpertSqlPanel
        onChange={(data: any) => {
          setExpertQuery(data);
          updateParent(data, "expert");
        }}
      />
    </div>
  );
}
