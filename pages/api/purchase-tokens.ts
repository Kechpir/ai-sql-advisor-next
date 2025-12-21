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
    // Получаем JWT токен из заголовка Authorization
    const authHeader = req.headers.authorization;
    const jwt = authHeader?.replace(/^Bearer /i, '') || null;
    const userId = getUserIdFromJWT(jwt);

    if (!userId) {
      return res.status(401).json({ error: "Не авторизован" });
    }

    // Получаем тип пакета из тела запроса
    const { package_type } = req.body || {};
    
    if (!package_type || !['small', 'large'].includes(package_type)) {
      return res.status(400).json({ 
        error: "Неверный тип пакета. Используйте 'small' (1.5M за $2) или 'large' (2.5M за $3.5)" 
      });
    }

    if (!process.env.NEXT_PUBLIC_SUPABASE_URL) {
      return res.status(500).json({ error: "Конфигурация сервера не настроена" });
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
    const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim().replace(/\s+/g, '');
    const serviceKey = (process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY)?.trim().replace(/\s+/g, '');
    
    if (!anonKey && !serviceKey) {
      return res.status(500).json({ error: "Supabase ключ не настроен" });
    }

    // Используем service key для вызова RPC функции (нужны права для покупки)
    const supabase = createClient(
      supabaseUrl,
      serviceKey || anonKey!,
      {
        auth: {
          persistSession: false,
          autoRefreshToken: false,
        },
        global: {
          ...(jwt && anonKey ? { headers: { 'Authorization': `Bearer ${jwt}` } } : {})
        }
      }
    );

    // Вызываем функцию покупки токенов
    const { data, error } = await supabase.rpc('purchase_additional_tokens', {
      user_uuid: userId,
      package_type: package_type
    });

    if (error) {
      console.error("Ошибка покупки токенов:", error);
      return res.status(400).json({ 
        error: error.message || "Ошибка при покупке токенов" 
      });
    }

    // Проверяем результат
    if (!data || !data.success) {
      return res.status(400).json({ 
        error: data?.error || "Не удалось купить токены" 
      });
    }

    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    return res.status(200).json({
      success: true,
      tokens_added: data.tokens_added,
      price: data.price,
      message: data.message
    });
  } catch (err: any) {
    console.error("Ошибка покупки токенов:", err);
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    return res.status(500).json({
      error: String(err?.message || "Внутренняя ошибка сервера"),
    });
  }
}

