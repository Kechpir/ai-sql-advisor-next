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

    // Проверка 1: Переменные окружения
    const envCheck = {
      hasUrl: !!supabaseUrl,
      url: supabaseUrl ? supabaseUrl.substring(0, 50) + '...' : null,
      hasSUPABASE_SERVICE_KEY: !!serviceKeyFromEnv,
      hasSUPABASE_SERVICE_ROLE_KEY: !!serviceRoleKeyFromEnv,
      serviceKeyLength: serviceKey?.length || 0,
      serviceKeyPrefix: serviceKey?.substring(0, 20) || null,
    };

    if (!supabaseUrl || !serviceKey) {
      return res.status(200).json({
        step: "env_check",
        status: "error",
        message: "Отсутствуют обязательные переменные окружения",
        envCheck,
      });
    }

    // Проверка 2: Подключение к Supabase с дополнительными опциями
    const supabase = createClient(supabaseUrl, serviceKey, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
    });
    
    // Проверка 2.1: Тест service key через другую таблицу (например, subscriptions)
    const { data: testTable, error: testError } = await supabase
      .from('subscriptions')
      .select('id')
      .limit(1);
    
    const serviceKeyWorks = !testError || testError.code !== 'PGRST301';
    
    // Проверка 3: Проверка существования таблицы user_query_logs
    const { data: tableCheck, error: tableError } = await supabase
      .from('user_query_logs')
      .select('id')
      .limit(1);

    if (tableError) {
      // Если service key работает, но таблицы нет - миграция не применена
      const isTableMissing = tableError.code === 'PGRST116' || tableError.message?.includes('does not exist');
      
      return res.status(200).json({
        step: "table_check",
        status: "error",
        message: isTableMissing 
          ? "Таблица user_query_logs не существует - миграция не применена"
          : "Ошибка при проверке таблицы",
        error: tableError.message,
        code: tableError.code,
        details: tableError.details,
        hint: isTableMissing 
          ? "Нужно применить миграцию: supabase/migrations/20251222_user_query_logs.sql"
          : tableError.hint,
        envCheck,
        serviceKeyWorks,
        testTableCheck: testError?.message || 'ok',
      });
    }

    // Проверка 4: Подсчет записей
    const { count, error: countError } = await supabase
      .from('user_query_logs')
      .select('*', { count: 'exact', head: true });

    return res.status(200).json({
      step: "success",
      status: "ok",
      message: "Таблица существует и доступна",
      envCheck,
      tableExists: true,
      recordCount: count || 0,
      countError: countError?.message || null,
    });

  } catch (error: any) {
    return res.status(200).json({
      step: "exception",
      status: "error",
      message: "Исключение при проверке",
      error: error.message,
      stack: error.stack,
    });
  }
}

