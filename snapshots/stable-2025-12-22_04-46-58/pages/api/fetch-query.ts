import type { NextApiRequest, NextApiResponse } from "next";
import { Client as PgClient } from "pg";
import mysql from "mysql2/promise";
import sqlite3 from "sqlite3";
import { open } from "sqlite";
import { jsonToSql } from "@/lib/db/jsonToSql";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const { connectionString, query, dbType, ...jsonQuery } = req.body;

  if (!connectionString) {
    return res.status(400).json({ error: "❌ Missing connection string" });
  }

  // Определяем тип БД из connectionString, если не указан
  let detectedDbType = dbType || "postgres";
  if (connectionString.startsWith("mysql://")) detectedDbType = "mysql";
  else if (connectionString.startsWith("postgres://") || connectionString.startsWith("postgresql://")) detectedDbType = "postgres";
  else if (connectionString.startsWith("sqlite://") || connectionString.startsWith("file:")) detectedDbType = "sqlite";

  // Генерируем SQL из jsonQuery, если передан объект, иначе используем готовый query
  let sqlQuery = query;
  if (!sqlQuery && jsonQuery.table) {
    sqlQuery = jsonToSql({ ...jsonQuery, dbType: detectedDbType });
  }

  if (!sqlQuery) {
    return res.status(400).json({ error: "❌ Missing SQL query or query parameters" });
  }

  // Валидация SQL запроса (защита от SQL injection)
  const sqlUpper = sqlQuery.trim().toUpperCase();
  if (!sqlUpper.startsWith('SELECT')) {
    return res.status(400).json({ error: "❌ Only SELECT queries are allowed" });
  }

  // Блокируем опасные операции
  const dangerKeywords = /DROP|DELETE|UPDATE|INSERT|ALTER|TRUNCATE|CREATE|GRANT|REVOKE|EXEC|EXECUTE|CALL/i;
  if (dangerKeywords.test(sqlQuery)) {
    return res.status(400).json({ error: "❌ Dangerous operations are not allowed" });
  }

  // Максимальная длина запроса (защита от DoS)
  if (sqlQuery.length > 100000) {
    return res.status(400).json({ error: "❌ SQL query is too long (max 100KB)" });
  }

  // Очистка от мульти-запросов (берем только первый до ;)
  // Драйверы pg и mysql2 могут вести себя нестабильно с мульти-запросами
  const firstQuery = sqlQuery.split(';').filter((s: string) => s.trim()).length > 0 
    ? sqlQuery.split(';').filter((s: string) => s.trim())[0].trim() + ';'
    : sqlQuery;

  try {
    let rows: any[] = [];
    let columns: string[] = [];

    // === PostgreSQL ===
    if (detectedDbType === "postgres" || detectedDbType === "postgresql") {
      const client = new PgClient({ connectionString });
      await client.connect();
      // Выполняем только первый запрос для стабильности
      const result = await client.query(firstQuery);
      rows = result.rows || [];
      columns = result.fields ? result.fields.map((f) => f.name) : [];
      await client.end();
    }

    // === MySQL ===
    else if (detectedDbType === "mysql") {
      const conn = await mysql.createConnection(connectionString);
      const [result, fields] = await conn.execute(sqlQuery);
      rows = result as any[];
      columns = fields ? fields.map((f: any) => f.name) : [];
      await conn.end();
    }

    // === SQLite ===
    else if (detectedDbType === "sqlite") {
      const dbPath = connectionString.replace(/^(sqlite:\/\/|file:)/, "");
      const db = await open({ filename: dbPath, driver: sqlite3.Database });
      const result = await db.all(sqlQuery);
      rows = result;
      columns = result.length ? Object.keys(result[0]) : [];
      await db.close();
    }

    // === MSSQL ===
    else if (detectedDbType === "mssql") {
      // Для MSSQL нужен отдельный драйвер, пока возвращаем ошибку
      return res.status(400).json({ error: "MSSQL support coming soon. Use PostgreSQL or MySQL for now." });
    }

    // === Oracle ===
    else if (detectedDbType === "oracle") {
      return res.status(400).json({ error: "Oracle support coming soon. Use PostgreSQL or MySQL for now." });
    }

    return res.status(200).json({
      success: true,
      sql: sqlQuery,
      columns,
      rows,
    });
  } catch (error: any) {
    console.error("❌ SQL Error:", error.message);
    return res.status(500).json({ error: error.message || "Database connection error" });
  }
}
