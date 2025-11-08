// /pages/api/fetch-query.ts
import type { NextApiRequest, NextApiResponse } from "next";
import { jsonToSql } from "../@/utils/jsonToSql";
import { createClient } from "@supabase/supabase-js";

// 🔐 Подключение к Supabase
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabase = createClient(supabaseUrl, supabaseKey);

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Метод не поддерживается" });
  }

  try {
    const jsonBody = req.body;

    // 🧩 Валидация
    if (!jsonBody || typeof jsonBody !== "object" || !jsonBody.table) {
      return res.status(400).json({ error: "Неверный формат запроса" });
    }

    // 🧠 Генерация SQL
    const sql = jsonToSql(jsonBody);

    // 🚫 Безопасность
    const forbidden = /(DROP|ALTER|TRUNCATE|GRANT|REVOKE|CREATE|DELETE\s+FROM\s+users)/i;
    if (forbidden.test(sql)) {
      return res.status(403).json({
        safe: false,
        blocked: true,
        sql,
        error: "Опасная SQL-команда заблокирована",
      });
    }

    // ⚙️ Выполнение SQL через RPC
    const { data, error } = await supabase.rpc("execute_sql", { sql_text: sql });

    if (error) {
      console.error("SQL Error:", error);
      return res.status(500).json({ sql, error: error.message });
    }

    // 📊 Преобразуем результат
    const rows = Array.isArray(data) ? data : [];
    const columns = rows.length > 0 ? Object.keys(rows[0]) : [];

    // ✅ Возвращаем в удобном формате
    return res.status(200).json({
      success: true,
      sql,
      columns,
      rows,
    });
  } catch (err: any) {
    console.error("Ошибка API:", err);
    return res.status(500).json({ error: (err as Error).message });
  }
}
