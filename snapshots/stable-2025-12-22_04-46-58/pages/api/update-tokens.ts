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
    const payloadBase64 = parts[1].replace(/-/g, '+').replace(/_/g, '/');
    const payload = JSON.parse(Buffer.from(payloadBase64, 'base64').toString('utf-8'));
    return payload?.sub ?? null;
  } catch {
    return null;
  }
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const origin = req.headers.origin;
  setCorsHeaders(res, origin);
  
  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }
  
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Метод не поддерживается" });
  }

  const authHeader = req.headers.authorization;
  const jwt = authHeader?.replace(/^Bearer /i, '') || null;
  const userId = getUserIdFromJWT(jwt);

  if (!userId) {
    return res.status(401).json({ error: "Не авторизован" });
  }

  const { tokens_used } = req.body || {};
  
  if (typeof tokens_used !== 'number' || tokens_used <= 0) {
    return res.status(400).json({ error: "Неверное значение tokens_used" });
  }

  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
    const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim().replace(/\s+/g, '');
    const serviceKey = (process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY)?.trim().replace(/\s+/g, '');
    
    if (!supabaseUrl) {
      return res.status(500).json({ error: "NEXT_PUBLIC_SUPABASE_URL не настроен" });
    }
    
    if (!anonKey && !serviceKey) {
      return res.status(500).json({ error: "Supabase ключи не настроены" });
    }

    // Используем anon key с JWT для работы с RLS, если есть JWT
    // Иначе используем service key
    const useAnonKey = jwt && anonKey;
    const supabaseKey = useAnonKey ? anonKey! : (serviceKey || anonKey!);
    
    const supabase = createClient(
      supabaseUrl,
      supabaseKey,
      {
        auth: { persistSession: false, autoRefreshToken: false },
        global: {
          ...(jwt && useAnonKey ? { headers: { 'Authorization': `Bearer ${jwt}` } } : {})
        }
      }
    );

    const { data: rpcData, error: rpcError } = await supabase.rpc("add_user_tokens", {
      user_uuid: userId,
      tokens_to_add: tokens_used,
    });

    if (rpcError) {
      console.error('[update-tokens] RPC ошибка:', rpcError);
      return res.status(500).json({ 
        error: "Ошибка обновления токенов",
        details: rpcError.message 
      });
    }

    return res.status(200).json({ 
      success: true,
      new_total: rpcData 
    });
  } catch (err: any) {
    console.error("[update-tokens] Ошибка:", err);
    return res.status(500).json({
      error: String(err?.message || "Ошибка обновления токенов"),
    });
  }
}

