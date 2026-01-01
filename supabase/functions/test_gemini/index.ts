// supabase/functions/test_gemini/index.ts
// Тестовая генерация SQL через Gemini 2.5 Flash

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

// ===== Gemini =====
function buildPrompt(nl: string, schemaText: string | undefined, dialect: string): string {
  const parts = [
    "Ты - эксперт по SQL. Сгенерируй SQL запрос на основе следующего запроса на естественном языке.",
    "",
    `Диалект БД: ${dialect}`,
  ];
  
  if (schemaText) {
    parts.push("Схема базы данных:");
    parts.push(schemaText);
    parts.push("");
  }
  
  parts.push(`Запрос пользователя: "${nl}"`);
  parts.push("");
  parts.push("Требования:");
  parts.push("1. Генерируй ТОЛЬКО SELECT запросы (read-only)");
  parts.push("2. Используй ТОЧНЫЕ имена таблиц и колонок из схемы (не меняй регистр и названия)");
  parts.push("3. ВАЖНО для JOIN:");
  parts.push("   - Если в SELECT используются колонки из нескольких таблиц, все эти таблицы ДОЛЖНЫ быть в FROM/JOIN");
  parts.push("   - Если используешь products.name в SELECT - таблица products ОБЯЗАТЕЛЬНО должна быть в JOIN");
  parts.push("   - Правильно связывай таблицы через внешние ключи (например: orders.employeeid = employees.employeeid)");
  parts.push("   - Если нужна связь orders -> products, найди промежуточную таблицу (order_items, orderdetails и т.д.)");
  parts.push("4. Пример ПРАВИЛЬНО с JOIN:");
  parts.push("   SELECT employees.name, products.name FROM employees JOIN orders ON employees.id = orders.employee_id JOIN order_items ON orders.id = order_items.order_id JOIN products ON order_items.product_id = products.id");
  parts.push("5. Пример НЕПРАВИЛЬНО:");
  parts.push("   SELECT employees.name, products.name FROM employees JOIN orders ON ... (products нет в JOIN!)");
  parts.push("6. Если запрос требует изменения данных (INSERT, UPDATE, DELETE, DROP, ALTER), верни ошибку");
  parts.push("7. Верни только SQL запрос, без объяснений и без markdown");
  parts.push("");
  parts.push("SQL запрос:");
  
  return parts.join("\n");
}

async function callGemini(nl: string, schemaText: string | undefined, dialect: string): Promise<{ sql: string; usage: any }> {
  const apiKey = Deno.env.get("GEMINI_API_KEY");
  if (!apiKey) throw new Error("GEMINI_API_KEY is not set in Supabase secrets");

  const prompt = buildPrompt(nl, schemaText, dialect);
  
  // Gemini API endpoint - используем Gemini 2.5 Flash (доступна в Google AI Studio)
  const modelName = "gemini-2.5-flash";
  const apiUrl = `https://generativelanguage.googleapis.com/v1/models/${modelName}:generateContent?key=${apiKey}`;
  
  console.log(`[test_gemini] Используем модель: ${modelName}, URL: ${apiUrl.replace(apiKey, 'KEY_HIDDEN')}`);
  
  const startTime = Date.now();
  
  const resp = await fetch(apiUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      contents: [{
        parts: [{
          text: prompt
        }]
      }],
      generationConfig: {
        temperature: 0.3,
        maxOutputTokens: 1000,
      }
    }),
  });

  const duration = Date.now() - startTime;

  if (!resp.ok) {
    const errorText = await resp.text().catch(() => "");
    console.error(`[test_gemini] Gemini API error ${resp.status}: ${errorText}`);
    throw new Error(`Gemini API error ${resp.status}: ${errorText}`);
  }

  const data = await resp.json();
  
  // Извлекаем SQL из ответа Gemini
  const candidate = data?.candidates?.[0];
  const content = candidate?.content?.parts?.[0]?.text;
  const sql = content?.trim() || "";
  
  if (!sql) {
    throw new Error("Empty SQL from Gemini model");
  }

  // Извлекаем информацию об использовании токенов
  const usageMetadata = data?.usageMetadata || {};
  const usage = {
    total_tokens: usageMetadata.totalTokenCount || 0,
    prompt_tokens: usageMetadata.promptTokenCount || 0,
    completion_tokens: usageMetadata.candidatesTokenCount || 0,
  };

  console.log(`[test_gemini] ✅ SQL сгенерирован за ${duration}ms, токенов: ${usage.total_tokens}`);

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

    // Проверка авторизации (опционально для тестового endpoint)
    const auth = await verifyAuth(req);
    if (auth) {
      console.log(`[test_gemini] ✅ Авторизация успешна, user_id: ${auth.uid}`);
    } else {
      console.log(`[test_gemini] ⚠️ Авторизация не пройдена, продолжаем для тестирования`);
    }

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
        schemaText = JSON.stringify(payload.schema, null, 2);
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

    // Вызов Gemini
    const { sql, usage } = await callGemini(nl.trim(), schemaText, dialect);

    // Анализ опасности
    const dangers = detectDanger(sql);
    const isDanger = dangers.length > 0;

    return new Response(JSON.stringify({
      sql,
      usage,
      tokens_used: usage.total_tokens,
      provider: "gemini",
      model: "gemini-2.5-flash",
      blocked: false,
      dangers: isDanger ? dangers : undefined,
    }), {
      status: 200,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });

  } catch (error: any) {
    console.error("[test_gemini] Ошибка:", error);
    return new Response(JSON.stringify({
      error: error.message || "Ошибка генерации SQL через Gemini",
      provider: "gemini",
    }), {
      status: 500,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  }
});

