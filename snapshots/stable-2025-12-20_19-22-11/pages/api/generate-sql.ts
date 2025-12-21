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
    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${openaiApiKey}`,
      },
      body: JSON.stringify({
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
      }),
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

        console.log(`[generate-sql] Обновление токенов: userId=${userId}, tokensUsed=${tokensUsed}`);

        if (userId && process.env.NEXT_PUBLIC_SUPABASE_URL) {
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
            const { data: rpcData, error: rpcError } = await supabase.rpc("add_user_tokens", {
              user_uuid: userId,
              tokens_to_add: tokensUsed,
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

    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    return res.status(200).json({
      sql,
      blocked: isDangerous,
      withSafety: isDangerous ? `-- ⚠️ Запрос содержит опасные операции. Используй только SELECT:\n${sql}` : null,
      usage, // Возвращаем информацию об использовании токенов
    });
  } catch (err: any) {
    console.error("Ошибка генерации SQL:", err);
    const errorMessage = err?.message || "Ошибка генерации SQL";
    // Убеждаемся, что ошибка правильно сериализуется в JSON
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    return res.status(500).json({
      error: String(errorMessage),
    });
  }
}
