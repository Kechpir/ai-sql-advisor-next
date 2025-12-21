import type { NextApiRequest, NextApiResponse } from "next";
import { Client as PgClient } from "pg";
import mysql from "mysql2/promise";
import sqlite3 from "sqlite3";
import { open } from "sqlite";

type SchemaResponse = {
  success: boolean;
  schema?: Record<string, string[]>;
  error?: string;
};

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<SchemaResponse>
) {
  if (req.method !== "POST") {
    return res.status(405).json({ success: false, error: "Method not allowed" });
  }

  const { connectionString } = req.body;

  if (!connectionString) {
    return res.status(400).json({ success: false, error: "Missing connectionString" });
  }

  try {
    let schema: Record<string, string[]> = {};

    // 🐘 PostgreSQL
    if (connectionString.startsWith("postgres://")) {
      const client = new PgClient({ connectionString });
      await client.connect();

      const tablesRes = await client.query(`
        SELECT table_name
        FROM information_schema.tables
        WHERE table_schema = 'public'
      `);

      for (const row of tablesRes.rows) {
        const tableName = row.table_name;
        const columnsRes = await client.query(
          `SELECT column_name FROM information_schema.columns WHERE table_name = $1`,
          [tableName]
        );
        schema[tableName] = columnsRes.rows.map((c) => c.column_name);
      }

      await client.end();
    }

    // 🐬 MySQL
    else if (connectionString.startsWith("mysql://")) {
      const connection = await mysql.createConnection(connectionString);
      const [tables]: any = await connection.query("SHOW TABLES");

      for (const row of tables) {
        const tableName = Object.values(row)[0] as string;
        const [cols]: any = await connection.query(`SHOW COLUMNS FROM \`${tableName}\``);
        schema[tableName] = cols.map((c: any) => c.Field);
      }

      await connection.end();
    }

    // 🪶 SQLite
    else if (connectionString.startsWith("sqlite")) {
      const db = await open({
        filename: connectionString.split("sqlite://")[1],
        driver: sqlite3.Database,
      });

      const tables: { name: string }[] = await db.all(
        `SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'`
      );

      for (const t of tables) {
        const cols: { name: string }[] = await db.all(`PRAGMA table_info(${t.name})`);
        schema[t.name as string] = cols.map((c) => c.name);
      }

      await db.close();
    }

    // ❌ Unsupported database
    else {
      return res
        .status(400)
        .json({ success: false, error: "Unsupported database type or invalid connection string" });
    }

    // ✅ Return schema
    res.status(200).json({ success: true, schema });
  } catch (err: any) {
    console.error("❌ Schema fetch error:", err.message);
    res.status(500).json({ success: false, error: err.message });
  }
}
