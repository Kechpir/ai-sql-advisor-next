import type { NextApiRequest, NextApiResponse } from "next";
import { createClient } from '@supabase/supabase-js';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
    const serviceKeyFromEnv = process.env.SUPABASE_SERVICE_KEY?.trim();
    const serviceRoleKeyFromEnv = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
    const serviceKey = (serviceKeyFromEnv || serviceRoleKeyFromEnv)?.replace(/\s+/g, '');

    if (!supabaseUrl || !serviceKey) {
      return res.status(200).json({
        error: "Ключи не найдены",
        hasUrl: !!supabaseUrl,
        hasSUPABASE_SERVICE_KEY: !!serviceKeyFromEnv,
        hasSUPABASE_SERVICE_ROLE_KEY: !!serviceRoleKeyFromEnv,
      });
    }

    // Тест 1: Проверка формата ключа
    const keyInfo = {
      length: serviceKey.length,
      startsWith: serviceKey.substring(0, 10),
      endsWith: serviceKey.substring(serviceKey.length - 10),
      isJWT: serviceKey.split('.').length === 3,
    };

    // Тест 2: Попытка создать клиент и выполнить простой запрос
    const supabase = createClient(supabaseUrl, serviceKey, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
    });

    // Тест 3: Проверка существования таблицы
    const { data: tableCheck, error: tableError } = await supabase
      .from('user_query_logs')
      .select('id')
      .limit(1);

    // Тест 4: Попытка вставить тестовую запись (без user_id для теста)
    const { data: insertTest, error: insertError } = await supabase
      .from('user_query_logs')
      .insert({
        user_id: '00000000-0000-0000-0000-000000000000', // Тестовый UUID
        action_type: 'sql_generation',
        natural_language_query: 'TEST',
      })
      .select()
      .single();

    return res.status(200).json({
      keyInfo,
      tableCheck: {
        exists: !tableError,
        error: tableError?.message,
        code: tableError?.code,
        hint: tableError?.hint,
      },
      insertTest: {
        success: !insertError,
        error: insertError?.message,
        code: insertError?.code,
        hint: insertError?.hint,
        details: insertError?.details,
        data: insertTest,
      },
    });

  } catch (error: any) {
    return res.status(200).json({
      exception: error.message,
      stack: error.stack,
    });
  }
}

