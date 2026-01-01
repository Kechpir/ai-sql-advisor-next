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
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
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

// Типы действий
type ActionType = 
  | 'sql_generation'
  | 'sql_execution'
  | 'table_open'
  | 'data_export'
  | 'schema_load'
  | 'schema_save'
  | 'schema_delete'
  | 'connection_establish';

interface LogActionPayload {
  action_type: ActionType;
  sql_query?: string;
  natural_language_query?: string;
  schema_used?: any; // JSONB
  dialect?: string;
  rows_returned?: number;
  execution_time_ms?: number;
  success?: boolean;
  error_message?: string;
  tokens_used?: number;
  file_info?: any; // JSONB
  export_format?: string;
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const origin = req.headers.origin;
  setCorsHeaders(res, origin);
  
  // Обработка preflight запросов
  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }
  
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Метод не поддерживается (требуется POST)" });
  }

  try {
    const authHeader = req.headers.authorization;
    const jwt = authHeader?.replace(/^Bearer /i, '') || null;
    const userId = getUserIdFromJWT(jwt);

    if (!userId) {
      return res.status(401).json({ error: "Не авторизован" });
    }

    const payload: LogActionPayload = req.body;

    // Валидация обязательных полей
    if (!payload.action_type) {
      return res.status(400).json({ error: "Обязательное поле action_type не указано" });
    }

    // Валидация action_type
    const validActionTypes: ActionType[] = [
      'sql_generation',
      'sql_execution',
      'table_open',
      'data_export',
      'schema_load',
      'schema_save',
      'schema_delete',
      'connection_establish'
    ];
    
    if (!validActionTypes.includes(payload.action_type)) {
      return res.status(400).json({ error: `Недопустимый action_type: ${payload.action_type}` });
    }

    // Подключение к Supabase
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
    const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim().replace(/\s+/g, '');
    const serviceKeyFromEnv = process.env.SUPABASE_SERVICE_KEY?.trim();
    const serviceRoleKeyFromEnv = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
    const serviceKey = (serviceKeyFromEnv || serviceRoleKeyFromEnv)?.replace(/\s+/g, '');
    
    if (!supabaseUrl) {
      console.error('[log-action] NEXT_PUBLIC_SUPABASE_URL не настроен');
      return res.status(500).json({ error: "Ошибка конфигурации сервера: отсутствует SUPABASE_URL" });
    }
    
    if (!anonKey && !serviceKey) {
      console.error('[log-action] Ключи Supabase не настроены');
      return res.status(500).json({ error: "Ошибка конфигурации сервера: отсутствуют ключи Supabase" });
    }

    // Используем anon key с JWT токеном (как в generate-sql.ts) для работы с RLS
    // Если anon key недоступен, fallback на service key
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
      console.log('[log-action] Используем ANON key с JWT токеном');
    } else if (serviceKey) {
      supabase = createClient(supabaseUrl, serviceKey, {
        auth: {
          persistSession: false,
          autoRefreshToken: false,
        }
      });
      console.log('[log-action] Используем SERVICE key (fallback)');
    } else {
      return res.status(500).json({ error: "Ошибка конфигурации: нужен либо ANON_KEY+JWT, либо SERVICE_KEY" });
    }

    // Подготовка данных для записи
    const logData = {
      user_id: userId,
      action_type: payload.action_type,
      sql_query: payload.sql_query || null,
      natural_language_query: payload.natural_language_query || null,
      schema_used: payload.schema_used || null,
      dialect: payload.dialect || null,
      rows_returned: payload.rows_returned || null,
      execution_time_ms: payload.execution_time_ms || null,
      success: payload.success !== undefined ? payload.success : true,
      error_message: payload.error_message || null,
      tokens_used: payload.tokens_used || null,
      file_info: payload.file_info || null,
      export_format: payload.export_format || null,
    };

    console.log('[log-action] Попытка записи лога:', {
      userId,
      action_type: payload.action_type,
      hasSql: !!payload.sql_query,
      hasSchema: !!payload.schema_used,
    });

    // Запись в БД
    console.log('[log-action] Данные для вставки:', {
      user_id: logData.user_id,
      action_type: logData.action_type,
      hasSql: !!logData.sql_query,
      hasSchema: !!logData.schema_used,
    });

    const { data, error } = await supabase
      .from('user_query_logs')
      .insert(logData)
      .select()
      .single();

    if (error) {
      console.error('[log-action] Ошибка записи лога:', {
        message: error.message,
        code: error.code,
        details: error.details,
        hint: error.hint,
        userId,
        action_type: payload.action_type,
        supabaseUrl: supabaseUrl?.substring(0, 50),
        serviceKeyLength: serviceKey?.length,
        serviceKeyPrefix: serviceKey?.substring(0, 20),
      });
      
      // Дополнительная диагностика: проверка формата ключа
      const keyParts = serviceKey?.split('.') || [];
      console.error('[log-action] Диагностика ключа:', {
        isJWT: keyParts.length === 3,
        part1Length: keyParts[0]?.length,
        part2Length: keyParts[1]?.length,
        part3Length: keyParts[2]?.length,
      });
      
      return res.status(500).json({ 
        error: `Ошибка записи лога: ${error.message}`,
        code: error.code,
        hint: error.hint,
      });
    }

    console.log('[log-action] Лог успешно записан:', { id: data?.id, action_type: payload.action_type });
    return res.status(200).json({ success: true, id: data?.id });

  } catch (error: any) {
    console.error('[log-action] Необработанная ошибка:', error);
    return res.status(500).json({ error: error?.message || "Внутренняя ошибка сервера" });
  }
}

