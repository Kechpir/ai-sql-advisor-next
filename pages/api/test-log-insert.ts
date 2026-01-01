import type { NextApiRequest, NextApiResponse } from "next";
import { createClient } from '@supabase/supabase-js';

// Извлечение user_id из JWT токена
function getUserIdFromJWT(jwt: string | null): string | null {
  if (!jwt) return null;
  try {
    const parts = jwt.split(".");
    if (parts.length !== 3) return null;
    const payload = JSON.parse(Buffer.from(parts[1], 'base64').toString('utf-8'));
    return payload?.sub ?? null;
  } catch {
    return null;
  }
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const authHeader = req.headers.authorization;
    const jwt = authHeader?.replace(/^Bearer /i, '') || null;
    const userId = getUserIdFromJWT(jwt);

    if (!userId) {
      return res.status(401).json({ error: "Не авторизован" });
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
    const serviceKey = (process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY)?.trim().replace(/\s+/g, '');

    if (!supabaseUrl || !serviceKey) {
      return res.status(500).json({ error: "Supabase не настроен" });
    }

    const supabase = createClient(supabaseUrl, serviceKey);

    // Тестовая запись
    const testData = {
      user_id: userId,
      action_type: 'sql_generation',
      natural_language_query: 'TEST: проверка записи в лог',
      success: true,
    };

    console.log('[test-log-insert] Попытка записи:', { userId, action_type: testData.action_type });

    const { data, error } = await supabase
      .from('user_query_logs')
      .insert(testData)
      .select()
      .single();

    if (error) {
      console.error('[test-log-insert] Ошибка:', {
        message: error.message,
        code: error.code,
        details: error.details,
        hint: error.hint,
      });
      return res.status(500).json({
        error: error.message,
        code: error.code,
        details: error.details,
        hint: error.hint,
      });
    }

    console.log('[test-log-insert] Успех:', { id: data?.id });
    return res.status(200).json({ success: true, id: data?.id, data });
  } catch (error: any) {
    console.error('[test-log-insert] Исключение:', error);
    return res.status(500).json({ error: error.message, stack: error.stack });
  }
}

