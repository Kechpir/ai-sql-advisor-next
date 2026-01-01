import type { NextApiRequest, NextApiResponse } from "next";
import { createClient } from '@supabase/supabase-js';

// CORS заголовки
function setCorsHeaders(res: NextApiResponse, origin: string | undefined) {
  const allowedOrigins = [
    'https://ai-sql-advisor.vercel.app',
    'https://ai-sql-advisor-next-stage.vercel.app',
    'http://localhost:3000',
    'http://localhost:3001'
  ];
  
  const originHeader = origin && allowedOrigins.includes(origin) ? origin : allowedOrigins[0];
  
  res.setHeader('Access-Control-Allow-Origin', originHeader);
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
}

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
  const origin = req.headers.origin;
  setCorsHeaders(res, origin);
  
  // Обработка preflight запросов
  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }
  
  if (req.method !== "GET") {
    return res.status(405).json({ error: "Метод не поддерживается (требуется GET)" });
  }

  try {
    const authHeader = req.headers.authorization;
    const jwt = authHeader?.replace(/^Bearer /i, '') || null;
    const userId = getUserIdFromJWT(jwt);

    if (!userId) {
      return res.status(401).json({ error: "Не авторизован" });
    }

    const limit = parseInt(req.query.limit as string || '10', 10);
    const days = parseInt(req.query.days as string || '30', 10);

    // Подключение к Supabase
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
    const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim().replace(/\s+/g, '');
    const serviceKeyFromEnv = process.env.SUPABASE_SERVICE_KEY?.trim();
    const serviceRoleKeyFromEnv = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
    const serviceKey = (serviceKeyFromEnv || serviceRoleKeyFromEnv)?.replace(/\s+/g, '');
    
    if (!supabaseUrl) {
      console.error('[get-frequent-queries] NEXT_PUBLIC_SUPABASE_URL не настроен');
      return res.status(500).json({ error: "Ошибка конфигурации сервера: отсутствует SUPABASE_URL" });
    }
    
    if (!anonKey && !serviceKey) {
      console.error('[get-frequent-queries] Ключи не найдены в переменных окружения');
      return res.status(500).json({ error: "Ошибка конфигурации сервера: отсутствуют ключи Supabase" });
    }

    // Используем anon key с JWT токеном для работы с RLS политиками (как в get-token-usage.ts)
    // RLS политика "Users can view their own logs" требует auth.uid(), который работает только с JWT
    let supabase;
    if (anonKey && jwt) {
      supabase = createClient(
        supabaseUrl,
        anonKey,
        {
          auth: {
            persistSession: false,
            autoRefreshToken: false,
          },
          global: {
            headers: {
              'Authorization': `Bearer ${jwt}`,
            }
          }
        }
      );
      console.log('[get-frequent-queries] Используем ANON key с JWT токеном');
    } else if (serviceKey) {
      // Fallback на service key (если anon key не настроен)
      supabase = createClient(supabaseUrl, serviceKey, {
        auth: {
          persistSession: false,
          autoRefreshToken: false,
        }
      });
      console.log('[get-frequent-queries] Используем SERVICE key (fallback)');
    } else {
      return res.status(500).json({ error: "Ошибка конфигурации: нужен либо ANON_KEY+JWT, либо SERVICE_KEY" });
    }

    // Получаем все SQL запросы за последние N дней (sql_generation и sql_execution)
    const { data: allLogs, error } = await supabase
      .from('user_query_logs')
      .select('sql_query, natural_language_query, action_type')
      .eq('user_id', userId)
      .in('action_type', ['sql_generation', 'sql_execution'])
      .or('sql_query.not.is.null,natural_language_query.not.is.null')
      .gte('created_at', new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString());

    if (error) {
      console.error('[get-frequent-queries] Ошибка получения частых запросов:', error);
      return res.status(500).json({ error: `Ошибка получения частых запросов: ${error.message}` });
    }

    // Подсчитываем частоту вручную (нормализуем SQL для группировки)
    const queryCounts: Record<string, { sql: string; count: number }> = {};
    allLogs?.forEach(log => {
      // Приоритет: sql_query > natural_language_query
      const queryText = log.sql_query || log.natural_language_query;
      if (queryText) {
        // Нормализуем SQL (убираем лишние пробелы, приводим к нижнему регистру для группировки)
        const normalized = queryText.trim().replace(/\s+/g, ' ').toLowerCase();
        const original = queryText.trim();
        
        if (!queryCounts[normalized]) {
          queryCounts[normalized] = { sql: original, count: 0 };
        }
        queryCounts[normalized].count += 1;
      }
    });

    // Сортируем и берем топ
    const frequentQueries = Object.values(queryCounts)
      .sort((a, b) => b.count - a.count)
      .slice(0, limit);

    return res.status(200).json({ queries: frequentQueries });

  } catch (error: any) {
    console.error('[get-frequent-queries] Необработанная ошибка:', error);
    return res.status(500).json({ error: error?.message || "Внутренняя ошибка сервера" });
  }
}

