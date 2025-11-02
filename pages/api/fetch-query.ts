// /pages/api/fetch-query.ts
import type { NextApiRequest, NextApiResponse } from "next";
import { jsonToSql } from "../../utils/jsonToSql";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabase = createClient(supabaseUrl, supabaseKey);

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  // Разрешаем только POST
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Метод не поддерживается" });
  }

  try {
    const jsonBody = req.body;

    // 🔒 Базовая валидация
    if (!jsonBody || typeof jsonBody !== "object" || !jsonBody.table) {
      return res.status(400).json({ error: "Неверный формат запроса" });
    }

    // 🚦 Генерация SQL
    const sql = jsonToSql(jsonBody);

    // 🚫 Проверка на опасные команды
    const forbidden = /(DROP|ALTER|TRUNCATE|GRANT|REVOKE|CREATE)/i;
    if (forbidden.test(sql)) {
      return res.status(403).json({ safe: false, blocked: true, sql, error: "Опасная команда" });
    }

    // 🧠 Выполнение SQL через Supabase
    const { data, error } = await supabase.rpc("execute_sql", { sql_text: sql });

    if (error) {
      console.error("SQL Error:", error);
      return res.status(500).json({ sql, error: error.message });
    }

    // ✅ Успешный ответ
    return res.status(200).json({ sql, data, safe: true });
  } catch (err) {
    console.error("Ошибка API:", err);
    return res.status(500).json({ error: (err as Error).message });
  }
}
