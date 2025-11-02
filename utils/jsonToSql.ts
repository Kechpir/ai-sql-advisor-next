// /utils/jsonToSql.ts

interface SqlFilter {
  field: string;
  op: string;
  value: string | number;
}

interface SqlOrder {
  field: string;
  direction?: "ASC" | "DESC";
}

interface SqlJoin {
  type: "INNER" | "LEFT" | "RIGHT" | "FULL";
  table: string;
  on: string; // например: "users.id = orders.user_id"
}

interface SqlQueryJSON {
  table: string;
  fields: string[];
  filters?: SqlFilter[];
  orderBy?: SqlOrder[];
  groupBy?: string[];
  joins?: SqlJoin[];
  limit?: number;
  transaction?: boolean;
}

/**
 * Преобразует JSON-запрос из конструктора в валидный SQL-текст.
 */
export function jsonToSql(query: SqlQueryJSON): string {
  if (!query.table || !query.fields?.length) {
    throw new Error("Некорректный запрос: отсутствует таблица или поля.");
  }

  // SELECT
  const selectClause = query.fields.join(", ");

  // FROM
  const fromClause = `FROM ${query.table}`;

  // JOIN
  const joinClause = (query.joins || [])
    .map((join) => `${join.type} JOIN ${join.table} ON ${join.on}`)
    .join(" ");

  // WHERE
  const whereClause =
    query.filters && query.filters.length > 0
      ? "WHERE " +
        query.filters
          .map((f) => {
            const val =
              typeof f.value === "string"
                ? `'${f.value.replace(/'/g, "''")}'`
                : f.value;
            return `${f.field} ${f.op} ${val}`;
          })
          .join(" AND ")
      : "";

  // GROUP BY
  const groupByClause =
    query.groupBy && query.groupBy.length > 0
      ? "GROUP BY " + query.groupBy.join(", ")
      : "";

  // ORDER BY
  const orderByClause =
    query.orderBy && query.orderBy.length > 0
      ? "ORDER BY " +
        query.orderBy
          .map((o) => `${o.field} ${o.direction || "ASC"}`)
          .join(", ")
      : "";

  // LIMIT
  const limitClause = query.limit ? `LIMIT ${query.limit}` : "";

  // Финальный SQL
  let sql = `SELECT ${selectClause} ${fromClause} ${joinClause} ${whereClause} ${groupByClause} ${orderByClause} ${limitClause};`;

  // Если включена транзакция
  if (query.transaction) {
    sql = `BEGIN; ${sql} COMMIT;`;
  }

  return sql.trim().replace(/\s+/g, " ");
}
