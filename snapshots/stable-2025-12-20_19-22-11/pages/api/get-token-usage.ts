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
    // Получаем JWT токен из заголовка Authorization
    const authHeader = req.headers.authorization;
    const jwt = authHeader?.replace(/^Bearer /i, '') || null;
    const userId = getUserIdFromJWT(jwt);

    if (!userId) {
      return res.status(401).json({ error: "Не авторизован" });
    }

    if (!process.env.NEXT_PUBLIC_SUPABASE_URL) {
      console.error("NEXT_PUBLIC_SUPABASE_URL не настроен");
      // Возвращаем 0 токенов вместо ошибки, чтобы счетчик работал
      return res.status(200).json({
        tokens_used: 0,
        period_start: null,
        period_end: null,
      });
    }

    // Используем ANON_KEY для чтения (он должен работать с RLS политиками)
    // SERVICE_KEY используем только если нужен обход RLS
    const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim().replace(/\s+/g, '');
    const serviceKey = (process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY)?.trim().replace(/\s+/g, '');
    
    // Отладочное логирование (без вывода самого ключа)
    console.log('[get-token-usage] Проверка ключей:', {
      hasServiceKey: !!serviceKey,
      hasAnonKey: !!anonKey,
      serviceKeyLength: serviceKey?.length || 0,
      anonKeyLength: anonKey?.length || 0,
    });
    
    if (!anonKey && !serviceKey) {
      console.error("⚠️ Supabase ключ не настроен!");
      console.error("Добавьте в .env.local: NEXT_PUBLIC_SUPABASE_ANON_KEY");
      // Возвращаем 0 токенов вместо ошибки, чтобы счетчик работал
      return res.status(200).json({
        tokens_used: 0,
        period_start: null,
        period_end: null,
      });
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
    if (!supabaseUrl) {
      console.error("⚠️ NEXT_PUBLIC_SUPABASE_URL не настроен!");
      return res.status(200).json({
        tokens_used: 0,
        period_start: null,
        period_end: null,
      });
    }

    // Используем anon key с JWT токеном для работы с RLS политиками
    // Service key может быть невалидным, поэтому предпочитаем anon key
    let supabase;
    
    if (anonKey) {
      // Anon key + JWT токен пользователя для RLS
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
      console.log('[get-token-usage] Используем ANON key с JWT токеном');
    } else if (serviceKey) {
      // Fallback на service key (если anon key не настроен)
      supabase = createClient(
        supabaseUrl,
        serviceKey,
        {
          auth: {
            persistSession: false,
            autoRefreshToken: false,
          }
        }
      );
      console.log('[get-token-usage] Используем SERVICE key (fallback)');
    } else {
      return res.status(200).json({
        tokens_used: 0,
        period_start: null,
        period_end: null,
      });
    }

    // Получаем текущее количество токенов
    const { data, error } = await supabase
      .from("user_token_usage")
      .select("tokens_used, period_start, period_end")
      .eq("user_id", userId)
      .single();

    if (error) {
      // PGRST116 - запись не найдена (это нормально для новых пользователей)
      if (error.code === 'PGRST116') {
        return res.status(200).json({
          tokens_used: 0,
          period_start: null,
          period_end: null,
        });
      }
      
      // Другие ошибки (например, таблица не существует) - возвращаем 0
      console.warn("Ошибка получения токенов (возможно таблица не создана):", error.code, error.message);
      return res.status(200).json({
        tokens_used: 0,
        period_start: null,
        period_end: null,
      });
    }

    const tokensUsed = data?.tokens_used || 0;
    const periodStart = data?.period_start || null;
    const periodEnd = data?.period_end || null;

    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    return res.status(200).json({
      tokens_used: tokensUsed,
      period_start: periodStart,
      period_end: periodEnd,
    });
  } catch (err: any) {
    console.error("Ошибка получения токенов:", err);
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    return res.status(500).json({
      error: String(err?.message || "Ошибка получения токенов"),
    });
  }
}

