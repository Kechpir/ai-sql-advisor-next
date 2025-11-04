// /pages/api/fetch-query.ts
import type { NextApiRequest, NextApiResponse } from "next";
import { jsonToSql } from "../../utils/jsonToSql";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  // Разрешаем только POST
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Метод не поддерживается" });
  }

  try {
    const jsonBody = req.body;

    // 🔒 Валидация
    if (!jsonBody || typeof jsonBody !== "object" || !jsonBody.table) {
      return res.status(400).json({ error: "Неверный формат запроса" });
    }

    // 🚦 Генерация SQL
    const sql = jsonToSql(jsonBody);

    // 🚫 Проверка на опасные команды
    const forbidden = /(DROP|ALTER|TRUNCATE|GRANT|REVOKE|CREATE)/i;
    if (forbidden.test(sql)) {
      return res.status(403).json({
        safe: false,
        blocked: true,
        sql,
        error: "Опасная команда запрещена",
      });
    }

    // 🌐 Вызов Supabase Edge Function execute_sql
    const response = await fetch(
      `${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/execute_sql`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY}`,
        },
        body: JSON.stringify({ sql_text: sql }),
      }
    );

    const result = await response.json();

    if (!response.ok) {
      console.error("SQL Error:", result);
      return res.status(500).json({ sql, error: result.error || "Ошибка при выполнении SQL" });
    }

    // ✅ Успешный ответ
    return res.status(200).json({
      sql,
      data: result.data || [],
      safe: true,
    });
  } catch (err) {
    console.error("Ошибка API:", err);
    return res.status(500).json({ error: (err as Error).message });
  }
}
