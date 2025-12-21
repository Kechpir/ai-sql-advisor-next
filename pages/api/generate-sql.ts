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
    if (parts.length !== 3) {
      console.warn('[generate-sql] JWT имеет неверный формат (не 3 части)');
      return null;
    }
    // Безопасное декодирование base64
    const payloadBase64 = parts[1].replace(/-/g, '+').replace(/_/g, '/');
    const payload = JSON.parse(Buffer.from(payloadBase64, 'base64').toString('utf-8'));
    const userId = payload?.sub ?? null;
    if (!userId) {
      console.warn('[generate-sql] JWT не содержит sub (user_id)');
    }
    return userId;
  } catch (err: any) {
    console.warn('[generate-sql] Ошибка декодирования JWT:', err?.message || String(err));
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

  // Безопасное чтение тела запроса
  let body;
  try {
    body = req.body;
    // Если тело уже распарсено Next.js, используем его
    if (!body && req.method === 'POST') {
      // Fallback для случаев, когда Next.js не распарсил тело
      return res.status(400).json({ error: "Не удалось прочитать тело запроса" });
    }
  } catch (e) {
    console.error("Ошибка чтения тела запроса:", e);
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    return res.status(400).json({ error: "Ошибка парсинга тела запроса" });
  }

  const { nl, schema, dialect = "postgres" } = body || {};

  if (!nl || !schema) {
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    return res.status(400).json({ error: "Не переданы nl (запрос) или schema (схема БД)" });
  }

  // Проверка лимита токенов перед генерацией
  const authHeader = req.headers.authorization;
  const jwt = authHeader?.replace(/^Bearer /i, '') || null;
  const userId = getUserIdFromJWT(jwt);

  // КРИТИЧНО: Проверка лимита токенов ДО генерации SQL
  if (userId) {
    try {
      const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
      const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim().replace(/\s+/g, '');
      const serviceKey = (process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY)?.trim().replace(/\s+/g, '');
      
      if (!supabaseUrl || (!anonKey && !serviceKey)) {
        console.warn('[generate-sql] Supabase не настроен, пропускаем проверку лимитов');
        // Если Supabase не настроен, продолжаем (для локальной разработки)
      } else {
        const supabase = createClient(
          supabaseUrl,
          serviceKey || anonKey!,
          {
            auth: { persistSession: false, autoRefreshToken: false },
            global: { ...(jwt && anonKey ? { headers: { 'Authorization': `Bearer ${jwt}` } } : {}) }
          }
        );

        // Проверка rate limit
        const { data: rateLimitCheck, error: rateLimitError } = await supabase.rpc('check_rate_limit', {
          user_uuid: userId,
          endpoint_name: 'generate_sql',
          limit_count: 10,
          window_type: 'minute'
        });

        if (rateLimitError) {
          console.error('[generate-sql] Ошибка проверки rate limit:', rateLimitError);
          return res.status(500).json({ error: "Ошибка проверки лимита запросов" });
        }

        if (rateLimitCheck === false) {
          return res.status(429).json({ error: "Превышен лимит запросов. Попробуйте позже." });
        }

        // КРИТИЧЕСКАЯ проверка лимита токенов - обязательна!
        const { data: tokenLimit, error: tokenLimitError } = await supabase.rpc('check_token_limit', {
          user_uuid: userId
        });

        if (tokenLimitError) {
          console.error('[generate-sql] Ошибка проверки лимита токенов:', tokenLimitError);
          return res.status(500).json({ 
            error: "Ошибка проверки лимита токенов",
            details: tokenLimitError.message || String(tokenLimitError)
          });
        }

        // Проверяем, что есть данные о лимите
        if (!tokenLimit || !Array.isArray(tokenLimit) || tokenLimit.length === 0) {
          console.error('[generate-sql] Лимит токенов не найден для пользователя:', userId);
          return res.status(500).json({ error: "Не удалось получить информацию о лимите токенов" });
        }

        const limitData = tokenLimit[0];
        
        // Блокируем генерацию, если лимит достигнут или токенов нет
        if (!limitData.within_limit || (limitData.remaining !== undefined && limitData.remaining <= 0)) {
          console.warn('[generate-sql] Лимит токенов достигнут:', {
            userId,
            tokens_used: limitData.tokens_used,
            token_limit: limitData.token_limit,
            remaining: limitData.remaining
          });
          return res.status(403).json({ 
            error: "Достигнут лимит токенов",
            limit_reached: true,
            tokens_used: limitData.tokens_used,
            token_limit: limitData.token_limit,
            remaining: limitData.remaining || 0
          });
        }

        console.log('[generate-sql] Проверка лимита токенов пройдена:', {
          userId,
          tokens_used: limitData.tokens_used,
          token_limit: limitData.token_limit,
          remaining: limitData.remaining
        });
      }
    } catch (limitError: any) {
      console.error("[generate-sql] Критическая ошибка проверки лимитов:", limitError);
      // КРИТИЧНО: Если проверка лимитов не удалась, блокируем генерацию
      return res.status(500).json({ 
        error: "Ошибка проверки лимитов. Генерация заблокирована для безопасности.",
        details: limitError?.message || String(limitError)
      });
    }
  } else {
    console.warn('[generate-sql] Пользователь не авторизован, пропускаем проверку лимитов');
    // Если пользователь не авторизован, можно продолжить (для локальной разработки)
    // Но в production лучше блокировать
  }

  const openaiApiKey = process.env.OPENAI_API_KEY;
  if (!openaiApiKey) {
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    return res.status(500).json({ 
      error: "OPENAI_API_KEY не настроен. Добавь его в .env.local файл." 
    });
  }

  try {
    // Формируем промпт для OpenAI
    // Безопасная сериализация схемы
    let schemaText: string;
    try {
      schemaText = typeof schema === "string" 
        ? schema 
        : JSON.stringify(schema, null, 2);
    } catch (e) {
      console.error("Ошибка сериализации схемы:", e);
      res.setHeader('Content-Type', 'application/json; charset=utf-8');
      return res.status(400).json({ error: "Неверный формат схемы БД" });
    }

    // Проверяем, есть ли данные из файла в запросе
    const hasFileContext = nl.includes("Контекст из файла");
    
    const prompt = `Ты - эксперт по SQL. Сгенерируй SQL запрос на основе следующего запроса на естественном языке.

Диалект БД: ${dialect}
Схема базы данных:
${schemaText}

Запрос пользователя: "${nl}"

${hasFileContext ? "⚠️ ВНИМАНИЕ: В запросе содержится контекст из загруженного файла. Проанализируй структуру данных из файла и используй её для формирования SQL запроса. Если в файле есть примеры данных, используй их для понимания структуры." : ""}

Требования:
1. Генерируй ТОЛЬКО SELECT запросы (read-only)
2. Используй правильные имена таблиц и колонок из схемы
3. Если запрос требует изменения данных (INSERT, UPDATE, DELETE, DROP, ALTER), верни ошибку
4. Верни только SQL запрос, без объяснений
${hasFileContext ? "5. Если в файле есть данные, которые нужно использовать для фильтрации или анализа, включи их в запрос" : ""}

SQL запрос:`;

    // Вызываем OpenAI API
    // Убеждаемся, что все данные правильно кодируются в UTF-8
    const requestBody = {
      model: "gpt-4o-mini", // или gpt-4o, если доступен
      messages: [
        {
          role: "system",
          content: "Ты - эксперт по SQL. Генерируй только безопасные SELECT запросы на основе схемы БД.",
        },
        {
          role: "user",
          content: prompt,
        },
      ],
      temperature: 0.3,
      max_tokens: 1000,
    };

    // Сериализуем в JSON с правильной кодировкой UTF-8
    const requestBodyJson = JSON.stringify(requestBody);
    
    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json; charset=utf-8",
        "Authorization": `Bearer ${openaiApiKey}`,
      },
      body: requestBodyJson,
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ error: "Ошибка OpenAI API" }));
      throw new Error(errorData.error?.message || `OpenAI API error: ${response.status}`);
    }

    const data = await response.json();
    const sql = data.choices?.[0]?.message?.content?.trim() || "";
    const usage = data?.usage || null;
    const tokensUsed = usage?.total_tokens || 0;

    if (!sql) {
      throw new Error("OpenAI не вернул SQL запрос");
    }

    // Обновление счетчика токенов (если есть авторизация)
    if (tokensUsed > 0) {
      try {
        const authHeader = req.headers.authorization;
        const jwt = authHeader?.replace(/^Bearer /i, '') || null;
        const userId = getUserIdFromJWT(jwt);

        console.log(`[generate-sql] Обновление токенов: userId=${userId}, tokensUsed=${tokensUsed}, jwt=${jwt ? 'present' : 'missing'}`);

        if (!userId) {
          console.warn('[generate-sql] userId не найден, пропускаем обновление токенов');
        } else if (!process.env.NEXT_PUBLIC_SUPABASE_URL) {
          console.warn('[generate-sql] NEXT_PUBLIC_SUPABASE_URL не настроен, пропускаем обновление токенов');
        } else {
          // Используем ANON_KEY с JWT токеном для работы с RLS
          const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim().replace(/\s+/g, '');
          const serviceKey = (process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY)?.trim().replace(/\s+/g, '');
          
          if (!anonKey && !serviceKey) {
            console.warn("Supabase ключ не настроен, пропускаем обновление токенов");
            console.warn("Добавьте в .env.local: NEXT_PUBLIC_SUPABASE_ANON_KEY");
          } else {
            const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
            let supabase;
            
            if (anonKey) {
              // Anon key + JWT токен для RLS
              supabase = createClient(
                supabaseUrl!,
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
              console.log('[generate-sql] Используем ANON key с JWT для обновления токенов');
            } else {
              // Fallback на service key
              supabase = createClient(
                supabaseUrl!,
                serviceKey!,
                {
                  auth: {
                    persistSession: false,
                    autoRefreshToken: false,
                  }
                }
              );
              console.log('[generate-sql] Используем SERVICE key для обновления токенов');
            }

            // Используем RPC функцию для атомарного обновления
            console.log(`[generate-sql] Вызов add_user_tokens: userId=${userId}, tokensToAdd=${tokensUsed}`);
            const { data: rpcData, error: rpcError } = await supabase.rpc("add_user_tokens", {
              user_uuid: userId,
              tokens_to_add: tokensUsed,
            });

            console.log(`[generate-sql] Результат add_user_tokens:`, {
              hasData: !!rpcData,
              data: rpcData,
              hasError: !!rpcError,
              error: rpcError
            });

            if (rpcError) {
              console.warn(`[generate-sql] RPC ошибка:`, rpcError);
              // Fallback: если RPC не работает, используем прямой upsert
              const { data: existing, error: selectError } = await supabase
                .from("user_token_usage")
                .select("tokens_used")
                .eq("user_id", userId)
                .single();
              
              if (selectError && selectError.code !== 'PGRST116') {
                console.error(`[generate-sql] Ошибка получения существующих токенов:`, selectError);
              }
              
              const currentTokens = existing?.tokens_used || 0;
              const newTotal = currentTokens + tokensUsed;
              console.log(`[generate-sql] Fallback upsert: current=${currentTokens}, adding=${tokensUsed}, newTotal=${newTotal}`);
              
              const { error: upsertError } = await supabase
                .from("user_token_usage")
                .upsert({
                  user_id: userId,
                  tokens_used: newTotal,
                  updated_at: new Date().toISOString(),
                }, { onConflict: "user_id" });
              
              if (upsertError) {
                console.error(`[generate-sql] Ошибка upsert токенов:`, upsertError);
              } else {
                console.log(`[generate-sql] ✅ Токены успешно обновлены через upsert: ${newTotal}`);
              }
            } else {
              console.log(`[generate-sql] ✅ Токены успешно обновлены через RPC: ${rpcData}`);
            }

            // Логирование использования (если таблица существует)
            try {
              await supabase.from("api_usage_logs").insert({
                user_id: userId,
                function_name: "generate_sql",
                tokens_used: tokensUsed,
                created_at: new Date().toISOString(),
              });
            } catch (logError) {
              // Игнорируем ошибки логирования
              console.warn("Failed to log usage (table may not exist):", logError);
            }
          }
        }
      } catch (tokenError) {
        // Игнорируем ошибки обновления токенов, но логируем
        console.warn("Failed to update token count (table may not exist):", tokenError);
      }
    }

    // Проверяем на опасные операции
    const dangerKeywords = /DROP|DELETE|UPDATE|INSERT|ALTER|TRUNCATE|CREATE|GRANT|REVOKE/i;
    const isDangerous = dangerKeywords.test(sql);

    // Отправляем событие для обновления счетчика токенов на фронте
    // Это будет обработано в TokenCounter компоненте
    if (typeof window !== 'undefined') {
      // В API route нет window, но событие будет отправлено через response
      // Фронт должен слушать событие после получения ответа
    }

    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    return res.status(200).json({
      sql,
      blocked: isDangerous,
      withSafety: isDangerous ? `-- ⚠️ Запрос содержит опасные операции. Используй только SELECT:\n${sql}` : null,
      usage, // Возвращаем информацию об использовании токенов
      tokens_used: tokensUsed, // Добавляем информацию о потраченных токенах
    });
  } catch (err: any) {
    console.error("[generate-sql] Ошибка генерации SQL:", err);
    console.error("[generate-sql] Stack:", err?.stack);
    console.error("[generate-sql] Детали:", {
      message: err?.message,
      code: err?.code,
      name: err?.name,
    });
    
    if (!res.headersSent) {
      res.setHeader('Content-Type', 'application/json; charset=utf-8');
      return res.status(500).json({
        error: String(err?.message || "Ошибка генерации SQL"),
        details: process.env.NODE_ENV === 'development' ? err?.stack : undefined
      });
    }
  }
}
