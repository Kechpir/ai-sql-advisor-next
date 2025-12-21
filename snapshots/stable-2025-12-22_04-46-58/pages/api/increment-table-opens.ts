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
  if (!jwt) {
    console.warn('[increment-table-opens] JWT токен отсутствует');
    return null;
  }
  try {
    const parts = jwt.split(".");
    if (parts.length !== 3) {
      console.warn('[increment-table-opens] JWT имеет неверный формат (не 3 части)');
      return null;
    }
    // Безопасное декодирование base64
    const payloadBase64 = parts[1].replace(/-/g, '+').replace(/_/g, '/');
    const payload = JSON.parse(Buffer.from(payloadBase64, 'base64').toString('utf-8'));
    const userId = payload?.sub ?? null;
    if (!userId) {
      console.warn('[increment-table-opens] JWT не содержит sub (user_id)');
    }
    return userId;
  } catch (err: any) {
    console.warn('[increment-table-opens] Ошибка декодирования JWT:', err?.message || String(err));
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
  
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Метод не поддерживается (требуется POST)" });
  }

  const authHeader = req.headers.authorization;
  const jwt = authHeader?.replace(/^Bearer /i, '') || null;
  const userId = getUserIdFromJWT(jwt);

  console.log('[increment-table-opens] Авторизация:', {
    hasAuthHeader: !!authHeader,
    hasJWT: !!jwt,
    jwtLength: jwt?.length || 0,
    userId: userId || 'не найден'
  });

  if (!userId) {
    console.error('[increment-table-opens] Пользователь не авторизован');
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    return res.status(401).json({ error: "Не авторизован" });
  }

  const { is_download = false } = req.body || {};

  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
    const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim().replace(/\s+/g, '');
    const serviceKey = (process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY)?.trim().replace(/\s+/g, '');
    
    console.log('[increment-table-opens] Настройки:', {
      hasSupabaseUrl: !!supabaseUrl,
      hasAnonKey: !!anonKey,
      hasServiceKey: !!serviceKey,
      userId: userId,
      isDownload: is_download
    });
    
    if (!supabaseUrl) {
      console.error('[increment-table-opens] NEXT_PUBLIC_SUPABASE_URL не настроен');
      return res.status(500).json({ error: "NEXT_PUBLIC_SUPABASE_URL не настроен" });
    }
    
    if (!anonKey && !serviceKey) {
      console.error('[increment-table-opens] Нет ни ANON_KEY, ни SERVICE_KEY');
      return res.status(500).json({ error: "Supabase ключи не настроены" });
    }

    // Используем anon key с JWT для работы с RLS, если есть JWT
    // Иначе используем service key
    const useAnonKey = jwt && anonKey;
    const supabaseKey = useAnonKey ? anonKey! : (serviceKey || anonKey!);
    
    console.log('[increment-table-opens] Создание Supabase клиента:', {
      useAnonKey: useAnonKey,
      hasJWT: !!jwt,
      keyType: useAnonKey ? 'anon' : (serviceKey ? 'service' : 'anon')
    });
    
    const supabase = createClient(
      supabaseUrl!,
      supabaseKey,
      {
        auth: {
          persistSession: false,
          autoRefreshToken: false,
        },
        global: {
          ...(jwt && useAnonKey ? { headers: { 'Authorization': `Bearer ${jwt}` } } : {})
        }
      }
    );

    // Сначала проверяем лимит
    console.log('[increment-table-opens] Вызов check_table_opens_limit с userId:', userId);
    const { data: limitCheck, error: limitError } = await supabase.rpc('check_table_opens_limit', {
      user_uuid: userId
    });

    console.log('[increment-table-opens] Результат check_table_opens_limit:', {
      hasData: !!limitCheck,
      dataType: typeof limitCheck,
      isArray: Array.isArray(limitCheck),
      data: limitCheck,
      hasError: !!limitError,
      error: limitError
    });

    if (limitError) {
      console.error('[increment-table-opens] Ошибка проверки лимита:', limitError);
      console.error('[increment-table-opens] Детали ошибки:', JSON.stringify(limitError, null, 2));
      return res.status(500).json({ 
        error: "Ошибка проверки лимита",
        details: limitError.message || String(limitError)
      });
    }

    // check_table_opens_limit возвращает TABLE, поэтому это массив
    const limit = Array.isArray(limitCheck) ? limitCheck[0] : limitCheck;
    
    if (!limit) {
      console.warn('[increment-table-opens] Лимит не найден, продолжаем без проверки');
    }
    
    const isDownload = Boolean(is_download);
    
    // Проверяем лимит
    if (isDownload) {
      if (limit && limit.downloads_remaining <= 0) {
        return res.status(403).json({ 
          error: "Достигнут лимит скачиваний",
          limit_reached: true,
          ...limit
        });
      }
    } else {
      if (limit && limit.remaining <= 0) {
        return res.status(403).json({ 
          error: "Достигнут лимит открытий таблиц",
          limit_reached: true,
          ...limit
        });
      }
    }

    // Увеличиваем счетчик
    console.log('[increment-table-opens] Вызов increment_table_opens с userId:', userId, 'isDownload:', isDownload);
    const { data: newCount, error: incrementError } = await supabase.rpc('increment_table_opens', {
      user_uuid: userId,
      is_download: isDownload
    });

    console.log('[increment-table-opens] Результат increment_table_opens:', {
      hasData: !!newCount,
      dataType: typeof newCount,
      isArray: Array.isArray(newCount),
      data: newCount,
      hasError: !!incrementError,
      error: incrementError
    });

    if (incrementError) {
      console.error('[increment-table-opens] Ошибка увеличения счетчика:', incrementError);
      console.error('[increment-table-opens] Детали ошибки:', JSON.stringify(incrementError, null, 2));
      return res.status(500).json({ 
        error: "Ошибка увеличения счетчика",
        details: incrementError.message || String(incrementError)
      });
    }

    // increment_table_opens возвращает INTEGER, не массив
    const countValue = typeof newCount === 'number' ? newCount : (Array.isArray(newCount) ? newCount[0] : null);
    console.log('[increment-table-opens] Счетчик увеличен:', countValue);

    // Получаем обновленные лимиты
    const { data: updatedLimit, error: updatedLimitError } = await supabase.rpc('check_table_opens_limit', {
      user_uuid: userId
    });

    if (updatedLimitError) {
      console.warn('[increment-table-opens] Ошибка получения обновленных лимитов:', updatedLimitError);
    }

    const updatedLimitData = Array.isArray(updatedLimit) ? updatedLimit[0] : updatedLimit;

    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    return res.status(200).json({
      success: true,
      count: countValue,
      limits: updatedLimitData || limit
    });
  } catch (err: any) {
    console.error("[increment-table-opens] Критическая ошибка:", err);
    console.error("[increment-table-opens] Stack:", err?.stack);
    console.error("[increment-table-opens] Детали:", {
      message: err?.message,
      code: err?.code,
      name: err?.name,
      userId: userId,
    });
    
    if (!res.headersSent) {
      res.setHeader('Content-Type', 'application/json; charset=utf-8');
      return res.status(500).json({
        error: String(err?.message || "Ошибка увеличения счетчика"),
        details: process.env.NODE_ENV === 'development' ? err?.stack : undefined
      });
    }
  }
}

