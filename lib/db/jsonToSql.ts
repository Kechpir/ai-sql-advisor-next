export function jsonToSql(query: any): string {
  if (!query) return "";

  const {
    queryType = "SELECT",
    table,
    fields = [],
    filters = [],
    joins = [],
    orderBy = [],
    groupBy = [],
    having = "",
    limit,
    offset,
    distinct = false,
    // Advanced
    aggregates = [],
    caseWhen = "",
    union = "",
    ctes = [],
    recursive = false,
    expressions = [],
    // Expert
    windowFunctions = [],
    subqueries = [],
    jsonOps = [],
    dateLogic = [],
    queryHints = "",
    pagination = {},
    transactionMode = false,
  } = query;

  // Проверка
  if (!table) return "-- ⚠️ Не выбрана таблица";

  // SELECT / DELETE / UPDATE / INSERT
  switch (queryType.toUpperCase()) {
    case "SELECT": {
      let sql = "";

      // WITH / CTE
      if (ctes.length > 0) {
        const cteParts = ctes.map((cte: any) => {
          if (typeof cte === "string") return cte;
          return `${cte.name} AS (${cte.query})`;
        });
        sql += `${recursive ? "WITH RECURSIVE" : "WITH"} ${cteParts.join(", ")} `;
      }

      // SELECT fields
      let fieldStr = "*";
      if (fields.length > 0) {
        const allFields = [...fields];
        if (aggregates.length > 0) {
          allFields.push(...aggregates.map((a: any) => {
            if (typeof a === "string") return a;
            return `${a.function}(${a.field})${a.alias ? ` AS ${a.alias}` : ""}`;
          }));
        }
        if (expressions.length > 0) {
          allFields.push(...expressions.map((e: any) => typeof e === "string" ? e : e.expression));
        }
        fieldStr = allFields.join(", ");
      }

      sql += `SELECT ${distinct ? "DISTINCT " : ""}${fieldStr} FROM ${table}`;

      // JOIN
      if (joins.length) {
        joins.forEach((j: any) => {
          const joinType = j.type || "INNER";
          const joinTable = j.table || "";
          const leftField = j.leftField || j.field1 || "";
          const rightField = j.rightField || j.field2 || "";
          if (joinTable && leftField && rightField) {
            sql += ` ${joinType} JOIN ${joinTable} ON ${leftField} = ${rightField}`;
          }
        });
      }

      // WHERE
      if (filters.length) {
        const whereClauses = filters
          .filter((f: any) => f.field)
          .map((f: any) => {
            if (f.op === "IS NULL" || f.op === "IS NOT NULL") {
              return `${f.field} ${f.op}`;
            }
            if (!f.value) return null;
            // Экранируем одинарные кавычки
            const escapedValue = String(f.value).replace(/'/g, "''");
            return `${f.field} ${f.op || "="} '${escapedValue}'`;
          })
          .filter(Boolean);
        if (whereClauses.length) sql += " WHERE " + whereClauses.join(" AND ");
      }

      // GROUP BY
      if (groupBy.length) {
        sql += " GROUP BY " + groupBy.join(", ");
      }

      // HAVING
      if (having) {
        sql += ` HAVING ${having}`;
      }

      // ORDER BY
      if (orderBy.length) {
        const orderClauses = orderBy
          .filter((o: any) => o.field)
          .map((o: any) => `${o.field} ${o.direction || "ASC"}`);
        if (orderClauses.length) sql += " ORDER BY " + orderClauses.join(", ");
      }

      // UNION
      if (union) {
        sql += ` ${union}`;
      }

      // LIMIT / OFFSET
      const finalLimit = limit || pagination?.pageSize || pagination?.limit;
      const finalOffset = offset || pagination?.offset || (pagination?.page && pagination?.pageSize 
        ? (pagination.page - 1) * pagination.pageSize 
        : null);

      if (finalLimit) sql += ` LIMIT ${finalLimit}`;
      if (finalOffset) sql += ` OFFSET ${finalOffset}`;

      return sql + ";";
    }

    case "DELETE": {
      let sql = `DELETE FROM ${table}`;
      if (filters.length) {
        const whereClauses = filters
          .filter((f: any) => f.field && f.value)
          .map((f: any) => `${f.field} ${f.op || "="} '${String(f.value).replace(/'/g, "''")}'`);
        if (whereClauses.length) sql += " WHERE " + whereClauses.join(" AND ");
      }
      return sql + ";";
    }

    case "UPDATE":
      return `UPDATE ${table} SET column=value WHERE condition;`;

    case "INSERT":
      return `INSERT INTO ${table} (...) VALUES (...);`;

    default:
      return "-- Неизвестный тип запроса";
  }
}
