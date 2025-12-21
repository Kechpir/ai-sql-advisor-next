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

  const authHeader = req.headers.authorization;
  const jwt = authHeader?.replace(/^Bearer /i, '') || null;
  const userId = getUserIdFromJWT(jwt);

  if (!userId) {
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    return res.status(401).json({ error: "Не авторизован" });
  }

  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
    const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim().replace(/\s+/g, '');
    const serviceKey = (process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY)?.trim().replace(/\s+/g, '');
    
    if (!supabaseUrl && (!anonKey || !serviceKey)) {
      return res.status(500).json({ error: "Supabase не настроен" });
    }

    const supabase = createClient(
      supabaseUrl!,
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

    // Проверяем лимит токенов
    const { data: tokenLimit, error: tokenError } = await supabase.rpc('check_token_limit', {
      user_uuid: userId
    });

    // Проверяем лимит открытий таблиц
    const { data: opensLimit, error: opensError } = await supabase.rpc('check_table_opens_limit', {
      user_uuid: userId
    });

    if (tokenError || opensError) {
      console.error('Ошибка проверки лимитов:', { tokenError, opensError });
      // Возвращаем базовые лимиты для free плана
      return res.status(200).json({
        tokens: {
          within_limit: true,
          tokens_used: 0,
          token_limit: 100000,
          remaining: 100000
        },
        table_opens: {
          within_limit: true,
          opens_count: 0,
          opens_limit: 20,
          remaining: 20,
          downloads_count: 0,
          downloads_limit: 20,
          downloads_remaining: 20
        },
        plan: 'free'
      });
    }

    // Получаем план пользователя
    const { data: subscription } = await supabase
      .from('subscriptions')
      .select('plan')
      .eq('user_id', userId)
      .eq('status', 'active')
      .gt('current_period_end', new Date().toISOString())
      .single();

    const plan = subscription?.plan || 'free';

    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    return res.status(200).json({
      tokens: tokenLimit?.[0] || {
        within_limit: true,
        tokens_used: 0,
        token_limit: 100000,
        remaining: 100000
      },
      table_opens: opensLimit?.[0] || {
        within_limit: true,
        opens_count: 0,
        opens_limit: 20,
        remaining: 20,
        downloads_count: 0,
        downloads_limit: 20,
        downloads_remaining: 20
      },
      plan
    });
  } catch (err: any) {
    console.error("Ошибка проверки лимитов:", err);
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    return res.status(500).json({
      error: String(err?.message || "Ошибка проверки лимитов")
    });
  }
}

