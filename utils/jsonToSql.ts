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
  queryType?: string; // SELECT | INSERT | UPDATE | DELETE | CREATE | ALTER | DROP
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
 * Конвертация JSON → SQL с учётом типа БД и команды.
 */
export function jsonToSql(query: SqlQueryJSON): string {
  if (!query.table) throw new Error("Не указана таблица.");
  if (!query.queryType) query.queryType = "SELECT";

  const dbType = query.dbType?.toLowerCase() || "postgres";
  const cmd = query.queryType.toUpperCase();

  let sql = "";

  switch (cmd) {
    // ======================================================
// 🔹 SELECT
// ======================================================
case "SELECT": {
  if (!query.fields?.length) throw new Error("Нет полей SELECT.");

  // 🔧 Фикс: фильтруем пустые поля, чтобы не было "SELECT id, , FROM ..."
  const validFields = query.fields.filter((f) => f && f.trim() !== "");
  const selectClause = validFields.length ? validFields.join(", ") : "*";

  const fromClause = `FROM ${query.table}`;
  const joinClause = (query.joins || [])
    .map((j) => `${j.type} JOIN ${j.table} ON ${j.on}`)
    .join(" ");

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

  const groupByClause =
    query.groupBy && query.groupBy.length > 0
      ? "GROUP BY " + query.groupBy.join(", ")
      : "";

  const orderByClause =
    query.orderBy && query.orderBy.length > 0
      ? "ORDER BY " +
        query.orderBy
          .map((o) => `${o.field} ${o.direction || "ASC"}`)
          .join(", ")
      : "";

  const limitClause =
    query.limit && dbType === "mssql"
      ? `TOP ${query.limit}`
      : query.limit
      ? `LIMIT ${query.limit}`
      : "";

  sql = `SELECT ${limitClause} ${selectClause} ${fromClause} ${joinClause} ${whereClause} ${groupByClause} ${orderByClause}`;
  break;
}


    // ======================================================
    // 🔹 INSERT
    // ======================================================
    case "INSERT": {
      if (!query.fields?.length)
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

    // ======================================================
    // 🔹 UPDATE
    // ======================================================
    case "UPDATE": {
      if (!query.fields?.length)
        throw new Error("Нет данных для обновления (fields).");

      const setClause = query.fields
        .map((f) => `${f} = ?`)
        .join(", "); // параметры подставляются позже API

      const whereClause =
        query.filters && query.filters.length > 0
          ? "WHERE " +
            query.filters
              .map((f) => `${f.field} ${f.op} ?`)
              .join(" AND ")
          : "";

      sql = `UPDATE ${query.table} SET ${setClause} ${whereClause}`;
      break;
    }

    // ======================================================
    // 🔹 DELETE
    // ======================================================
    case "DELETE": {
      const whereClause =
        query.filters && query.filters.length > 0
          ? "WHERE " +
            query.filters
              .map((f) => `${f.field} ${f.op} ?`)
              .join(" AND ")
          : "";

      sql = `DELETE FROM ${query.table} ${whereClause}`;
      break;
    }

    // ======================================================
    // 🔹 CREATE TABLE
    // ======================================================
    case "CREATE": {
      const cols = query.fields.join(", ");
      sql = `CREATE TABLE ${query.table} (${cols})`;
      break;
    }

    // ======================================================
    // 🔹 ALTER TABLE
    // ======================================================
    case "ALTER": {
      sql = `ALTER TABLE ${query.table} ADD COLUMN new_column VARCHAR(255)`;
      break;
    }

    // ======================================================
    // 🔹 DROP TABLE
    // ======================================================
    case "DROP": {
      sql = `DROP TABLE ${query.table}`;
      break;
    }

    default:
      throw new Error(`Неизвестный тип запроса: ${cmd}`);
  }

  // ======================================================
  // 🧱 Диалектные отличия (Postgres / MySQL / MSSQL)
  // ======================================================
  if (dbType === "mysql") {
    sql = sql.replace(/ILIKE/g, "LIKE"); // MySQL не знает ILIKE
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
