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
  on: string;
}

interface SqlQueryJSON {
  dbType?: string;
  queryType?: string;
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
 * Конвертация JSON → SQL с безопасной проверкой и форматированием
 */
export function jsonToSql(query: SqlQueryJSON): string {
  if (!query.table) throw new Error("Не указана таблица.");
  const cmd = query.queryType?.toUpperCase() || "SELECT";
  const dbType = query.dbType?.toLowerCase() || "postgres";

  let sql = "";

  switch (cmd) {
    case "SELECT": {
      const validFields = (query.fields || []).filter((f) => f && f.trim() !== "");
      const selectClause = validFields.length ? validFields.join(", ") : "*";

      const fromClause = `FROM ${query.table}`;
      const joinClause = (query.joins || [])
        .map((j) => `${j.type} JOIN ${j.table} ON ${j.on}`)
        .join(" ");

      const whereClause =
        query.filters && query.filters.length
          ? "WHERE " +
            query.filters
              .filter((f) => f.field && f.value !== undefined)
              .map((f) => {
                const val =
                  typeof f.value === "string"
                    ? `'${f.value.replace(/'/g, "''")}'`
                    : f.value;
                return `${f.field} ${f.op} ${val}`;
              })
              .join(" AND ")
          : "";

      const orderByClause =
        query.orderBy && query.orderBy.length
          ? "ORDER BY " +
            query.orderBy
              .filter((o) => o.field)
              .map((o) => `${o.field} ${o.direction || "ASC"}`)
              .join(", ")
          : "";

      const limitClause =
        query.limit && dbType === "mssql"
          ? `TOP ${query.limit}`
          : query.limit
          ? `LIMIT ${query.limit}`
          : "";

      sql = `SELECT ${limitClause} ${selectClause} ${fromClause} ${joinClause} ${whereClause} ${orderByClause}`;
      break;
    }

    case "INSERT": {
      if (!query.fields || query.fields.length === 0)
        throw new Error("Нет данных для вставки (fields).");
      const cols = Object.keys(query.fields).join(", ");
      const vals = Object.values(query.fields)
        .map((v) =>
          typeof v === "string" ? `'${v.replace(/'/g, "''")}'` : v
        )
        .join(", ");
      sql = `INSERT INTO ${query.table} (${cols}) VALUES (${vals})`;
      break;
    }

    case "UPDATE": {
      const setClause = (query.fields || [])
        .filter((f) => f && f.trim())
        .map((f) => `${f} = ?`)
        .join(", ");
      const whereClause =
        query.filters && query.filters.length
          ? "WHERE " +
            query.filters
              .filter((f) => f.field)
              .map((f) => `${f.field} ${f.op} ?`)
              .join(" AND ")
          : "";
      sql = `UPDATE ${query.table} SET ${setClause} ${whereClause}`;
      break;
    }

    case "DELETE": {
      const whereClause =
        query.filters && query.filters.length
          ? "WHERE " +
            query.filters
              .filter((f) => f.field)
              .map((f) => `${f.field} ${f.op} ?`)
              .join(" AND ")
          : "";
      sql = `DELETE FROM ${query.table} ${whereClause}`;
      break;
    }

    default:
      throw new Error(`Неизвестный тип запроса: ${cmd}`);
  }

  if (query.transaction) sql = `BEGIN; ${sql}; COMMIT;`;
  return sql.replace(/\s+/g, " ").trim();
}
