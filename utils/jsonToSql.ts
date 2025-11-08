export function jsonToSql(query: any): string {
  if (!query) return "";

  const { queryType = "SELECT", table, fields = [], filters = [], joins = [], orderBy = [], groupBy = [], limit } = query;

  // Проверка
  if (!table) return "-- ⚠️ Не выбрана таблица";

  // SELECT / DELETE / UPDATE / INSERT
  switch (queryType.toUpperCase()) {
    case "SELECT": {
      const fieldStr = fields.length ? fields.join(", ") : "*";
      let sql = `SELECT ${fieldStr} FROM ${table}`;

      // JOIN
      if (joins.length) {
        joins.forEach((j: any) => {
          sql += ` ${j.type || "INNER"} JOIN ${j.table} ON ${j.leftField} = ${j.rightField}`;
        });
      }

      // WHERE
      if (filters.length) {
        const whereClauses = filters
          .filter((f: any) => f.field && f.value)
          .map((f: any) => `${f.field} ${f.op || "="} '${f.value}'`);
        if (whereClauses.length) sql += " WHERE " + whereClauses.join(" AND ");
      }

      // GROUP BY
      if (groupBy.length) sql += " GROUP BY " + groupBy.join(", ");

      // ORDER BY
      if (orderBy.length) {
        const orderClauses = orderBy
          .filter((o: any) => o.field)
          .map((o: any) => `${o.field} ${o.direction || "ASC"}`);
        sql += " ORDER BY " + orderClauses.join(", ");
      }

      // LIMIT
      if (limit) sql += ` LIMIT ${limit}`;

      return sql + ";";
    }

    case "DELETE":
      return `DELETE FROM ${table};`;

    case "UPDATE":
      return `UPDATE ${table} SET column=value WHERE condition;`;

    case "INSERT":
      return `INSERT INTO ${table} (...) VALUES (...);`;

    default:
      return "-- Неизвестный тип запроса";
  }
}
