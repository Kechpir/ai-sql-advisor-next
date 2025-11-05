// /pages/api/fetch-schema.ts
import type { NextApiRequest, NextApiResponse } from "next";
import { Client } from "pg";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Метод не поддерживается (требуется POST)" });
  }

  const { connectionString } = req.body;
  if (!connectionString) {
    return res.status(400).json({ error: "Не передан connectionString" });
  }

  const client = new Client({ connectionString });

  try {
    await client.connect();

    // Забираем все таблицы и колонки из схемы public
    const query = `
      SELECT
        table_name,
        column_name,
        data_type
      FROM information_schema.columns
      WHERE table_schema = 'public'
      ORDER BY table_name, ordinal_position;
    `;

    const result = await client.query(query);

    // Преобразуем в удобный JSON
    const schema: Record<string, string[]> = {};
    result.rows.forEach((row) => {
      if (!schema[row.table_name]) schema[row.table_name] = [];
      schema[row.table_name].push(row.column_name);
    });

    await client.end();

    res.status(200).json({
      success: true,
      schema,
      tables: Object.keys(schema),
    });
  } catch (err: any) {
    console.error("Ошибка при получении схемы:", err);
    res.status(500).json({
      success: false,
      error: err.message || "Ошибка при подключении к базе данных",
    });
  } finally {
    await client.end().catch(() => {});
  }
}
