// @ts-nocheck
// supabase/functions/generate_sql/index.ts
// Генерация SQL через OpenAI с проверкой авторизации и подписки

// ===== CORS =====
const ALLOWED_ORIGINS = [
  'https://ai-sql-advisor.vercel.app',
  'https://ai-sql-advisor-next-stage.vercel.app',
  'http://localhost:3000',
  'http://localhost:3001'
];

function getCorsHeaders(origin: string | null) {
  const allowedOrigin = origin && ALLOWED_ORIGINS.includes(origin) 
    ? origin 
    : ALLOWED_ORIGINS[0];
  
  return {
    "Access-Control-Allow-Origin": allowedOrigin,
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
  };
}

// ===== JWT =====
function b64u(s: string): string {
  s = s.replace(/-/g, "+").replace(/_/g, "/");
  const p = s.length % 4;
  if (p) s += "=".repeat(4 - p);
  const b = atob(s);
  const a = new Uint8Array(b.length);
  for (let i = 0; i < b.length; i++) a[i] = b.charCodeAt(i);
  return new TextDecoder().decode(a);
}

function uidFromJwt(jwt: string | null): string | null {
  if (!jwt) return null;
  try {
    const parts = jwt.split(".");
    if (parts.length !== 3) return null;
    const payload = JSON.parse(b64u(parts[1]));
    return payload?.sub ?? null;
  } catch {
    return null;
  }
}

async function verifyAuth(req: Request): Promise<{ uid: string; jwt: string } | null> {
  const auth = req.headers.get("authorization") || req.headers.get("Authorization");
  if (!auth || !auth.toLowerCase().startsWith("bearer ")) return null;
  const jwt = auth.split(" ")[1];
  const uid = uidFromJwt(jwt);
  return uid ? { uid, jwt } : null;
}

async function checkSubscription(sb: any, userId: string): Promise<{ active: boolean; plan?: string; error?: string }> {
  try {
    console.log(`[checkSubscription] Проверка подписки для user_id: ${userId}`);
    
    // Сначала попробуем найти ВСЕ подписки для этого пользователя (без фильтров)
    const { data: allSubs, error: allError } = await sb
      .from("subscriptions")
      .select("plan, status, current_period_end, user_id")
      .eq("user_id", userId);
    
    console.log(`[checkSubscription] Все подписки для user_id ${userId}:`, JSON.stringify(allSubs));
    if (allError) {
      console.log(`[checkSubscription] Ошибка при получении всех подписок: ${JSON.stringify(allError)}`);
    }
    
    // Теперь запрос с фильтрами
    const { data, error } = await sb
      .from("subscriptions")
      .select("plan, status, current_period_end")
      .eq("user_id", userId)
      .eq("status", "active")
      .gt("current_period_end", new Date().toISOString())
      .single();
    
    if (error) {
      console.log(`[checkSubscription] Ошибка запроса с фильтрами: ${JSON.stringify(error)}`);
      console.log(`[checkSubscription] Код ошибки: ${error.code}, Сообщение: ${error.message}, Детали: ${JSON.stringify(error)}`);
      
      // Если ошибка "PGRST116" - это значит запись не найдена (это нормально)
      if (error.code === "PGRST116") {
        console.log(`[checkSubscription] Подписка не найдена для user_id: ${userId} (PGRST116)`);
        return { active: false, error: "Subscription not found (PGRST116)" };
      }
      
      // Если ошибка "42501" - это ошибка прав доступа (RLS блокирует)
      if (error.code === "42501" || error.message?.includes("permission") || error.message?.includes("policy")) {
        console.log(`[checkSubscription] ❌ ОШИБКА ПРАВ ДОСТУПА (RLS блокирует): ${error.message}`);
        return { active: false, error: `RLS policy blocked: ${error.message}` };
      }
      
      return { active: false, error: error.message || `Database error (code: ${error.code})` };
    }
    
    if (!data) {
      console.log(`[checkSubscription] Данные подписки не найдены для user_id: ${userId}`);
      return { active: false, error: "No subscription data" };
    }
    
    console.log(`[checkSubscription] ✅ Найдена активная подписка: plan=${data.plan}, status=${data.status}, expires=${data.current_period_end}`);
    return { active: true, plan: data.plan };
  } catch (e: any) {
    console.error(`[checkSubscription] Исключение при проверке подписки:`, e);
    return { active: false, error: e?.message || "Unknown error" };
  }
}

// ===== Validation =====
const MAX_NL_LENGTH = 5000; // символов
const MAX_SCHEMA_SIZE = 100 * 1024; // 100KB

function validateRequestSize(nl?: string, schemaText?: string): { valid: boolean; error?: string } {
  if (nl && nl.length > MAX_NL_LENGTH) {
    return { valid: false, error: `Request too long (max ${MAX_NL_LENGTH} chars)` };
  }
  if (schemaText && schemaText.length > MAX_SCHEMA_SIZE) {
    return { valid: false, error: `Schema too large (max ${MAX_SCHEMA_SIZE} bytes)` };
  }
  return { valid: true };
}

// ===== OpenAI =====
function buildSystemPrompt(dialect: string): string {
  return [
    "You are an expert SQL generator.",
    "Return ONLY a single SQL statement. No prose, no markdown, no triple backticks.",
    "Target dialect: " + dialect + ".",
    "RULES:",
    "- Use ONLY real table and column names from the provided schema if present.",
    "- Prefer explicit JOINs; qualify columns when helpful.",
    "- If user asks for mutating ops (DELETE/UPDATE/INSERT/etc), generate them plainly — do not add transactions.",
  ].join(" ");
}

async function callOpenAI(nl: string, schemaText: string | undefined, dialect: string, plan: string): Promise<{ sql: string; usage: any }> {
  const apiKey = Deno.env.get("OPENAI_API_KEY");
  if (!apiKey) throw new Error("OPENAI_API_KEY is not set");

  // Лимиты по тарифу
  const maxTokens = plan === "pro" ? 2000 : plan === "team" ? 4000 : 1000;

  const resp = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "gpt-4o-mini",
      temperature: 0.1,
      top_p: 0.9,
      max_tokens: maxTokens, // ОГРАНИЧЕНИЕ!
      messages: [
        { role: "system", content: buildSystemPrompt(dialect) },
        {
          role: "user",
          content: schemaText
            ? `Database schema (JSON):\n${schemaText}\n\nUser request: ${nl}`
            : `User request: ${nl}`,
        },
      ],
    }),
  });

  if (!resp.ok) {
    const t = await resp.text().catch(() => "");
    throw new Error(`OpenAI error ${resp.status}: ${t}`);
  }

  const data = await resp.json();
  const sql = data?.choices?.[0]?.message?.content?.trim?.() ?? "";
  const usage = data?.usage ?? null;
  if (!sql) throw new Error("Empty SQL from model");

  return { sql, usage };
}

// ===== SQL Analysis =====
function detectDanger(sql: string): string[] {
  const found = new Set<string>();
  const tokens = ["DROP", "ALTER", "TRUNCATE", "CREATE", "GRANT", "REVOKE", "DELETE", "UPDATE", "INSERT", "MERGE"];
  for (const t of tokens) {
    const re = new RegExp(`\\b${t}\\b`, "i");
    if (re.test(sql)) found.add(t);
  }
  return Array.from(found);
}

function wrapWithSavepoint(sql: string, savepointName: string = "ai_guard"): string {
  return [
    "BEGIN;",
    `SAVEPOINT ${savepointName};`,
    sql,
    `ROLLBACK TO SAVEPOINT ${savepointName}; -- если нужно отменить`,
    "COMMIT; -- когда уверены в результате",
  ].join("\n");
}

// ===== Main Handler =====
Deno.serve(async (req) => {
  const origin = req.headers.get("origin");
  const corsHeaders = getCorsHeaders(origin);

  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    if (req.method !== "POST") {
      return new Response(JSON.stringify({ error: "Use POST" }), {
        status: 405,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
    if (!SUPABASE_URL) {
      return new Response(JSON.stringify({ error: "Missing SUPABASE_URL" }), {
        status: 500,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    // Проверка авторизации
    const auth = await verifyAuth(req);
    if (!auth) {
      console.log(`[generate_sql] ❌ Авторизация не прошла - нет валидного JWT токена`);
      return new Response(JSON.stringify({ error: "unauthorized" }), {
        status: 401,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    const { uid, jwt } = auth;
    console.log(`[generate_sql] ✅ Авторизация успешна, user_id: ${uid}`);
    
    const { createClient } = await import("https://esm.sh/@supabase/supabase-js@2.47.7");
    
    // Для проверки подписки используем SERVICE_ROLE, чтобы обойти RLS
    // Это безопасно, так как мы уже проверили авторизацию через JWT
    // Пробуем разные варианты имени переменной для SERVICE_ROLE ключа
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") 
      || Deno.env.get("SERVICE_ROLE_KEY")
      || Deno.env.get("SUPABASE_SERVICE_KEY");
    
    console.log(`[generate_sql] Проверка секретов:`);
    console.log(`[generate_sql] - SUPABASE_SERVICE_ROLE_KEY: ${Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ? 'установлен' : 'НЕ установлен'}`);
    console.log(`[generate_sql] - SERVICE_ROLE_KEY: ${Deno.env.get("SERVICE_ROLE_KEY") ? 'установлен' : 'НЕ установлен'}`);
    console.log(`[generate_sql] - SUPABASE_SERVICE_KEY: ${Deno.env.get("SUPABASE_SERVICE_KEY") ? 'установлен' : 'НЕ установлен'}`);
    console.log(`[generate_sql] Итоговый serviceRoleKey: ${serviceRoleKey ? 'НАЙДЕН (длина: ' + serviceRoleKey.length + ')' : 'НЕ НАЙДЕН'}`);
    
    if (serviceRoleKey) {
      console.log(`[generate_sql] ✅ Используем SERVICE_ROLE ключ для проверки подписки (обход RLS)`);
    } else {
      console.log(`[generate_sql] ⚠️ SERVICE_ROLE ключ не найден, используем anon с JWT (может не работать из-за RLS)`);
      console.log(`[generate_sql] 💡 Установите секрет: supabase secrets set SUPABASE_SERVICE_ROLE_KEY=ваш-ключ`);
    }
    
    const sbForSubscription = serviceRoleKey 
      ? createClient(SUPABASE_URL, serviceRoleKey, {
          auth: {
            persistSession: false,
            autoRefreshToken: false,
          }
        })
      : createClient(SUPABASE_URL, "anon", {
          global: { headers: { Authorization: `Bearer ${jwt}` } },
        });
    
    // Для остальных операций используем anon с JWT
    const sb = createClient(SUPABASE_URL, "anon", {
      global: { headers: { Authorization: `Bearer ${jwt}` } },
    });

    // Проверка подписки (используем клиент с SERVICE_ROLE для обхода RLS)
    const subscription = await checkSubscription(sbForSubscription, uid);
    const skipSubscriptionCheck = Deno.env.get("SKIP_SUBSCRIPTION_CHECK") === "true";
    
    if (!subscription.active) {
      if (skipSubscriptionCheck) {
        console.log(`[generate_sql] ⚠️ Пропуск проверки подписки (SKIP_SUBSCRIPTION_CHECK=true) для user_id: ${uid}`);
      } else {
        console.log(`[generate_sql] ❌ Подписка не активна для user_id: ${uid}, ошибка: ${subscription.error || "unknown"}`);
        return new Response(JSON.stringify({ 
          error: "Subscription required",
          details: subscription.error || "No active subscription found",
          user_id: uid
        }), {
          status: 403,
          headers: { "Content-Type": "application/json", ...corsHeaders },
        });
      }
    } else {
      console.log(`[generate_sql] ✅ Подписка активна для user_id: ${uid}, plan: ${subscription.plan}`);
    }
    
    // Используем план из подписки или "free" по умолчанию
    const plan = subscription.active ? (subscription.plan || "free") : "free";
    console.log(`[generate_sql] Используемый план: ${plan}`);

    const payload = await req.json().catch(() => ({}));
    const nl = payload?.nl ?? "";
    if (!nl || typeof nl !== "string") {
      return new Response(JSON.stringify({ error: "Field 'nl' is required (string)" }), {
        status: 400,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    const dialect = payload?.dialect || "postgres";
    let schemaText: string | undefined;
    if (payload?.schema && typeof payload.schema === "object") {
      try {
        schemaText = JSON.stringify(payload.schema);
      } catch {}
    } else if (typeof payload?.schema === "string") {
      schemaText = payload.schema;
    }

    // Валидация размера запроса
    const sizeCheck = validateRequestSize(nl, schemaText);
    if (!sizeCheck.valid) {
      return new Response(JSON.stringify({ error: sizeCheck.error }), {
        status: 400,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    // Вызов OpenAI
    const { sql, usage } = await callOpenAI(nl.trim(), schemaText, dialect, plan);

    // Логирование использования (для биллинга)
    const tokensUsed = usage?.total_tokens || 0;
    try {
      await sb.from("api_usage_logs").insert({
        user_id: uid,
        function_name: "generate_sql",
        tokens_used: tokensUsed,
        created_at: new Date().toISOString(),
      });
    } catch (logError) {
      // Игнорируем ошибки логирования, но не прерываем выполнение
      console.error("Failed to log usage:", logError);
    }

    // Обновление счетчика токенов пользователя
    if (tokensUsed > 0) {
      try {
        // Используем RPC функцию для атомарного обновления
        const { error: rpcError } = await sb.rpc("add_user_tokens", {
          user_uuid: uid,
          tokens_to_add: tokensUsed,
        });

        if (rpcError) {
          // Fallback: если RPC не работает, используем прямой upsert
          const { data: existing } = await sb
            .from("user_token_usage")
            .select("tokens_used")
            .eq("user_id", uid)
            .single();
          
          const currentTokens = existing?.tokens_used || 0;
          await sb
            .from("user_token_usage")
            .upsert({
              user_id: uid,
              tokens_used: currentTokens + tokensUsed,
              updated_at: new Date().toISOString(),
            }, { onConflict: "user_id" });
        }
      } catch (tokenUpdateError) {
        // Игнорируем ошибки обновления токенов, но логируем
        console.error("Failed to update token count:", tokenUpdateError);
      }
    }

    const dangers = detectDanger(sql);
    const isDanger = dangers.length > 0;

    const variantPlain = sql;
    const variantSavepoint = isDanger ? wrapWithSavepoint(sql) : null;

    return new Response(
      JSON.stringify({
        blocked: false,
        sql: variantPlain,
        withSafety: variantSavepoint,
        variantPlain,
        variantSavepoint,
        dangers,
        usage,
      }),
      { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  } catch (e) {
    return new Response(JSON.stringify({ error: String(e?.message ?? e) }), {
      status: 500,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  }
});
