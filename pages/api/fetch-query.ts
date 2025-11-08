import type { NextApiRequest, NextApiResponse } from "next";
import { Client as PgClient } from "pg";
import mysql from "mysql2/promise";
import sqlite3 from "sqlite3";
import { open } from "sqlite";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const { connectionString, query, dbType } = req.body;

  if (!connectionString || !query) {
    return res.status(400).json({ error: "❌ Missing connection string or SQL query" });
  }

  try {
    let rows: any[] = [];
    let columns: string[] = [];

    // === PostgreSQL ===
    if (dbType === "postgres") {
      const client = new PgClient({ connectionString });
      await client.connect();
      const result = await client.query(query);
      rows = result.rows;
      columns = result.fields.map((f) => f.name);
      await client.end();
    }

    // === MySQL ===
    else if (dbType === "mysql") {
      const conn = await mysql.createConnection(connectionString);
      const [result, fields] = await conn.execute(query);
      rows = result as any[];
      columns = fields ? fields.map((f: any) => f.name) : [];
      await conn.end();
    }

    // === SQLite ===
    else if (dbType === "sqlite") {
      const db = await open({ filename: connectionString, driver: sqlite3.Database });
      const result = await db.all(query);
      rows = result;
      columns = result.length ? Object.keys(result[0]) : [];
      await db.close();
    }

    return res.status(200).json({
      success: true,
      sql: query,
      columns,
      rows,
    });
  } catch (error: any) {
    console.error("❌ SQL Error:", error.message);
    return res.status(500).json({ error: error.message });
  }
}
