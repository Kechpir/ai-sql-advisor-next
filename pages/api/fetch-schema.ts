// /pages/api/fetch-schema.ts
import type { NextApiRequest, NextApiResponse } from "next";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabase = createClient(supabaseUrl, supabaseKey);

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "GET") {
    return res.status(405).json({ error: "Метод не поддерживается" });
  }

  try {
    // Получаем таблицы и их колонки из схемы public
    const { data, error } = await supabase.rpc("execute_sql", {
      sql_text: `
        SELECT
          table_name,
          column_name,
          data_type
        FROM information_schema.columns
        WHERE table_schema = 'public'
        ORDER BY table_name, ordinal_position;
      `
    });

    if (error) throw error;

    // Форматируем в удобный вид
    const schema: Record<string, any[]> = {};
    (data || []).forEach((row: any) => {
      if (!schema[row.table_name]) schema[row.table_name] = [];
      schema[row.table_name].push({
        column: row.column_name,
        type: row.data_type,
      });
    });

    res.status(200).json({ success: true, schema });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
}
