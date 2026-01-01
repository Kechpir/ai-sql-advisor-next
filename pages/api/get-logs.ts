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

    // Параметры запроса
    const actionType = req.query.action_type as string | undefined;
    const limit = parseInt(req.query.limit as string || '100', 10);
    const offset = parseInt(req.query.offset as string || '0', 10);
    const search = req.query.search as string | undefined;
    const startDate = req.query.start_date as string | undefined;
    const endDate = req.query.end_date as string | undefined;

    // Подключение к Supabase
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
    const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim().replace(/\s+/g, '');
    const serviceKeyFromEnv = process.env.SUPABASE_SERVICE_KEY?.trim();
    const serviceRoleKeyFromEnv = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
    const serviceKey = (serviceKeyFromEnv || serviceRoleKeyFromEnv)?.replace(/\s+/g, '');
    
    if (!supabaseUrl) {
      console.error('[get-logs] NEXT_PUBLIC_SUPABASE_URL не настроен');
      return res.status(500).json({ error: "Ошибка конфигурации сервера: отсутствует SUPABASE_URL" });
    }
    
    if (!anonKey && !serviceKey) {
      console.error('[get-logs] Ключи не найдены в переменных окружения');
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
      console.log('[get-logs] Используем ANON key с JWT токеном');
    } else if (serviceKey) {
      // Fallback на service key (если anon key не настроен)
      supabase = createClient(supabaseUrl, serviceKey, {
        auth: {
          persistSession: false,
          autoRefreshToken: false,
        }
      });
      console.log('[get-logs] Используем SERVICE key (fallback)');
    } else {
      return res.status(500).json({ error: "Ошибка конфигурации: нужен либо ANON_KEY+JWT, либо SERVICE_KEY" });
    }

    // Построение запроса
    let query = supabase
      .from('user_query_logs')
      .select('*', { count: 'exact' })
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    // Фильтр по типу действия
    if (actionType) {
      query = query.eq('action_type', actionType);
    }

    // Фильтр по дате
    if (startDate) {
      query = query.gte('created_at', startDate);
    }
    if (endDate) {
      query = query.lte('created_at', endDate);
    }

    // Поиск по SQL запросу и текстовому запросу (через full-text search не работает напрямую, фильтруем на клиенте)
    const { data, error, count } = await query;

    if (error) {
      console.error('[get-logs] Ошибка получения логов:', error);
      return res.status(500).json({ error: `Ошибка получения логов: ${error.message}` });
    }

    // Фильтрация по поисковому запросу (если указан)
    let filteredData = data || [];
    if (search && search.trim()) {
      const searchLower = search.toLowerCase();
      filteredData = filteredData.filter(log => {
        const sqlMatch = log.sql_query?.toLowerCase().includes(searchLower);
        const nlMatch = log.natural_language_query?.toLowerCase().includes(searchLower);
        const errorMatch = log.error_message?.toLowerCase().includes(searchLower);
        return sqlMatch || nlMatch || errorMatch;
      });
    }

    return res.status(200).json({
      logs: filteredData,
      total: count || filteredData.length,
      limit,
      offset,
    });

  } catch (error: any) {
    console.error('[get-logs] Необработанная ошибка:', error);
    return res.status(500).json({ error: error?.message || "Внутренняя ошибка сервера" });
  }
}

