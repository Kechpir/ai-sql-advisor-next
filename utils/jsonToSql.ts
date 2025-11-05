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
  dbType?: string; // postgres | mysql | sqlite | mssql | oracle
  queryType?: string; // SELECT | INSERT | UPDATE | DELETE
  table: string;
  fields: string[];
  joins?: SqlJoin[];
  filters?: SqlFilter[];
  orderBy?: SqlOrder[];
  groupBy?: string[];
  limit?: number;
  aggregate?: boolean;
  transaction?: boolean;
}

/**
 * Конвертация JSON → SQL с учётом типа БД, join, group, limit и агрегатов
 */
export function jsonToSql(query: SqlQueryJSON): string {
  if (!query.table) throw new Error("Не указана таблица.");
  const cmd = (query.queryType || "SELECT").toUpperCase();
  const dbType = query.dbType?.toLowerCase() || "postgres";

  let sql = "";

  // ======================================================
  // 🔹 SELECT
  // ======================================================
  if (cmd === "SELECT") {
    if (!query.fields?.length) throw new Error("Нет выбранных полей для SELECT.");

    // Агрегаты
    let fieldsClause = "";
    if (query.aggregate) {
      fieldsClause = query.fields
        .map((f) => `COALESCE(SUM(${f}), 0) AS ${f}_sum`)
        .join(", ");
    } else {
      fieldsClause = query.fields.join(", ");
    }

    const fromClause = `FROM ${query.table}`;

    // JOIN
    const joinClause = (query.joins || [])
      .filter((j) => j.table && j.on)
      .map((j) => `${j.type} JOIN ${j.table} ON ${j.on}`)
      .join(" ");

    // WHERE
    const whereClause =
      query.filters && query.filters.length > 0
        ? "WHERE " +
          query.filters
            .filter((f) => f.field)
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
            .filter((o) => o.field)
            .map((o) => `${o.field} ${o.direction || "ASC"}`)
            .join(", ")
        : "";

    // LIMIT
    const limitClause =
      query.limit && dbType === "mssql"
        ? `TOP ${query.limit}`
        : query.limit
        ? `LIMIT ${query.limit}`
        : "";

    sql = `SELECT ${limitClause} ${fieldsClause} ${fromClause} ${joinClause} ${whereClause} ${groupByClause} ${orderByClause}`;
  }

  // ======================================================
  // 🔹 INSERT
  // ======================================================
  else if (cmd === "INSERT") {
    if (!query.fields?.length) throw new Error("Нет данных для вставки (fields).");
    const cols = Object.keys(query.fields).join(", ");
    const vals = Object.values(query.fields)
      .map((v) =>
        typeof v === "string" ? `'${v.replace(/'/g, "''")}'` : v
      )
      .join(", ");
    sql = `INSERT INTO ${query.table} (${cols}) VALUES (${vals})`;
  }

  // ======================================================
  // 🔹 UPDATE
  // ======================================================
  else if (cmd === "UPDATE") {
    if (!query.fields?.length) throw new Error("Нет данных для обновления (fields).");
    const setClause = query.fields.map((f) => `${f} = ?`).join(", ");
    const whereClause =
      query.filters && query.filters.length > 0
        ? "WHERE " +
          query.filters.map((f) => `${f.field} ${f.op} ?`).join(" AND ")
        : "";
    sql = `UPDATE ${query.table} SET ${setClause} ${whereClause}`;
  }

  // ======================================================
  // 🔹 DELETE
  // ======================================================
  else if (cmd === "DELETE") {
    const whereClause =
      query.filters && query.filters.length > 0
        ? "WHERE " +
          query.filters.map((f) => `${f.field} ${f.op} ?`).join(" AND ")
        : "";
    sql = `DELETE FROM ${query.table} ${whereClause}`;
  }

  // ======================================================
  // 🧱 Диалектные отличия (Postgres / MySQL / MSSQL / Oracle)
  // ======================================================
  if (dbType === "mysql") {
    sql = sql.replace(/ILIKE/g, "LIKE");
  } else if (dbType === "mssql") {
    sql = sql.replace(/LIMIT \d+/g, ""); // TOP уже используется
  } else if (dbType === "oracle") {
    sql = sql.replace(/LIMIT \d+/g, "FETCH FIRST n ROWS ONLY");
  }

  // ======================================================
  // 🔐 Транзакции
  // ======================================================
  if (query.transaction) {
    sql = `BEGIN; ${sql}; COMMIT;`;
  }

  return sql.trim().replace(/\s+/g, " ");
}
