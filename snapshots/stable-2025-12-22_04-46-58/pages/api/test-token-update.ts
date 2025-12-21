import type { NextApiRequest, NextApiResponse } from "next";
import { createClient } from '@supabase/supabase-js';

// Тестовый endpoint для проверки обновления токенов
// Использование: GET /api/test-token-update?tokens=1000

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "GET") {
    return res.status(405).json({ error: "Метод не поддерживается" });
  }

  try {
    // Получаем JWT токен из заголовка Authorization
    const authHeader = req.headers.authorization;
    const jwt = authHeader?.replace(/^Bearer /i, '') || null;
    
    if (!jwt) {
      return res.status(401).json({ error: "Не авторизован" });
    }

    // Извлекаем user_id из JWT
    const parts = jwt.split(".");
    if (parts.length !== 3) {
      return res.status(401).json({ error: "Невалидный JWT" });
    }
    
    const payload = JSON.parse(Buffer.from(parts[1], 'base64').toString('utf-8'));
    const userId = payload?.sub;
    
    if (!userId) {
      return res.status(401).json({ error: "Не удалось извлечь user_id из JWT" });
    }

    // Количество токенов для добавления (из query параметра или по умолчанию 100)
    const tokensToAdd = parseInt(req.query.tokens as string) || 100;

    if (!process.env.NEXT_PUBLIC_SUPABASE_URL) {
      return res.status(500).json({ error: "NEXT_PUBLIC_SUPABASE_URL не настроен" });
    }

    const serviceKey = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
    const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    const supabaseKey = serviceKey || anonKey;
    
    // Отладочное логирование
    console.log('[test-token-update] Проверка ключей:', {
      hasServiceKey: !!serviceKey,
      hasAnonKey: !!anonKey,
      serviceKeyLength: serviceKey?.length || 0,
      anonKeyLength: anonKey?.length || 0,
      usingKey: serviceKey ? 'SERVICE' : (anonKey ? 'ANON' : 'NONE'),
    });
    
    if (!supabaseKey) {
      return res.status(500).json({ 
        error: "Supabase ключ не настроен",
        hint: "Добавьте в .env.local: SUPABASE_SERVICE_KEY или NEXT_PUBLIC_SUPABASE_ANON_KEY"
      });
    }

    // Очистка ключа от пробелов и переносов строк
    const cleanKey = supabaseKey.trim().replace(/\s+/g, '');
    
    // Проверка формата ключа
    if (cleanKey.length < 100) {
      console.warn('[test-token-update] ⚠️ Ключ кажется слишком коротким:', cleanKey.length, 'символов');
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
    console.log('[test-token-update] URL:', supabaseUrl ? `${supabaseUrl.substring(0, 30)}...` : 'НЕ НАСТРОЕН');
    console.log('[test-token-update] Key preview:', cleanKey ? `${cleanKey.substring(0, 20)}...${cleanKey.substring(cleanKey.length - 10)}` : 'НЕТ');

    // Попробуем сначала с anon key, если service key не работает
    let supabase = createClient(
      supabaseUrl!,
      cleanKey,
      {
        auth: {
          persistSession: false,
          autoRefreshToken: false,
        }
      }
    );

    // Тест подключения - попробуем простой запрос
    const { error: testError } = await supabase.from('user_token_usage').select('id').limit(1);
    if (testError && testError.message.includes('Invalid API key')) {
      console.warn('[test-token-update] Service key не работает, пробуем anon key');
      const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim().replace(/\s+/g, '');
      if (anonKey && anonKey !== cleanKey) {
        supabase = createClient(
          supabaseUrl!,
          anonKey,
          {
            auth: {
              persistSession: false,
              autoRefreshToken: false,
            }
          }
        );
      }
    }

    // Получаем текущее количество токенов
    const { data: existing, error: selectError } = await supabase
      .from("user_token_usage")
      .select("tokens_used")
      .eq("user_id", userId)
      .single();

    const currentTokens = existing?.tokens_used || 0;
    const newTotal = currentTokens + tokensToAdd;

    // Пробуем RPC функцию
    const { data: rpcData, error: rpcError } = await supabase.rpc("add_user_tokens", {
      user_uuid: userId,
      tokens_to_add: tokensToAdd,
    });

    if (rpcError) {
      console.error("RPC ошибка:", rpcError);
      
      // Fallback через upsert
      const { data: upsertData, error: upsertError } = await supabase
        .from("user_token_usage")
        .upsert({
          user_id: userId,
          tokens_used: newTotal,
          updated_at: new Date().toISOString(),
        }, { onConflict: "user_id" })
        .select();

      if (upsertError) {
        return res.status(500).json({
          error: "Ошибка обновления токенов",
          details: {
            rpcError: rpcError.message,
            upsertError: upsertError.message,
            userId,
            currentTokens,
            tokensToAdd,
            newTotal,
          },
        });
      }

      return res.status(200).json({
        success: true,
        method: "upsert",
        previous: currentTokens,
        added: tokensToAdd,
        newTotal: upsertData?.[0]?.tokens_used || newTotal,
        data: upsertData,
      });
    }

    return res.status(200).json({
      success: true,
      method: "rpc",
      previous: currentTokens,
      added: tokensToAdd,
      newTotal: rpcData,
      rpcData,
    });
  } catch (err: any) {
    console.error("Ошибка теста токенов:", err);
    return res.status(500).json({
      error: String(err?.message || "Ошибка теста"),
      stack: err?.stack,
    });
  }
}

