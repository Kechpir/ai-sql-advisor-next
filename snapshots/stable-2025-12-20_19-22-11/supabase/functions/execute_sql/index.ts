// @ts-nocheck
// supabase/functions/execute_sql/index.ts
// Выполнение SQL запросов с проверкой авторизации, подписки и валидацией SQL

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

async function checkSubscription(sb: any, userId: string): Promise<{ active: boolean; plan?: string }> {
  try {
    const { data, error } = await sb
      .from("subscriptions")
      .select("plan, status, current_period_end")
      .eq("user_id", userId)
      .eq("status", "active")
      .gt("current_period_end", new Date().toISOString())
      .single();
    if (error || !data) return { active: false };
    return { active: true, plan: data.plan };
  } catch {
    return { active: false };
  }
}

// ===== SQL Validation =====
function validateSQL(sql: string): { valid: boolean; error?: string } {
  if (!sql || typeof sql !== "string") {
    return { valid: false, error: "SQL query is required" };
  }

  // Проверка на опасные операции
  const dangerous = /(DROP|DELETE|UPDATE|INSERT|ALTER|TRUNCATE|CREATE|GRANT|REVOKE|EXEC|EXECUTE)/i;
  if (dangerous.test(sql)) {
    return { valid: false, error: "Only SELECT queries are allowed" };
  }

  // Проверка на системные таблицы
  const systemTables = /(pg_|information_schema|sys\.|mysql\.)/i;
  if (systemTables.test(sql)) {
    return { valid: false, error: "System tables are not allowed" };
  }

  // Проверка на множественные запросы
  const queries = sql.split(";").filter((s) => s.trim());
  if (queries.length > 1) {
    return { valid: false, error: "Only single query is allowed" };
  }

  // Должен начинаться с SELECT
  const trimmed = sql.trim().toUpperCase();
  if (!trimmed.startsWith("SELECT")) {
    return { valid: false, error: "Only SELECT queries are allowed" };
  }

  return { valid: true };
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
      return new Response(JSON.stringify({ error: "unauthorized" }), {
        status: 401,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    const { uid, jwt } = auth;
    const { createClient } = await import("https://esm.sh/@supabase/supabase-js@2.47.7");
    
    // ⚠️ ВАЖНО: Используем ANON key с JWT, НЕ SERVICE_ROLE_KEY!
    const supabase = createClient(SUPABASE_URL, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: `Bearer ${jwt}` } },
    });

    // Проверка подписки
    const subscription = await checkSubscription(supabase, uid);
    if (!subscription.active) {
      return new Response(JSON.stringify({ error: "Subscription required" }), {
        status: 403,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    const payload = await req.json().catch(() => ({}));
    const sql_text = payload?.sql_text || payload?.sql || "";

    if (!sql_text || typeof sql_text !== "string") {
      return new Response(JSON.stringify({ error: "Field 'sql_text' is required" }), {
        status: 400,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    // Валидация SQL
    const sqlValidation = validateSQL(sql_text);
    if (!sqlValidation.valid) {
      return new Response(JSON.stringify({ error: sqlValidation.error }), {
        status: 400,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    // Логирование запроса (маскированный SQL)
    try {
      const maskedSql = sql_text.substring(0, 100) + (sql_text.length > 100 ? "..." : "");
      await supabase.from("api_usage_logs").insert({
        user_id: uid,
        function_name: "execute_sql",
        sql_preview: maskedSql,
        created_at: new Date().toISOString(),
      });
    } catch (logError) {
      console.error("Failed to log SQL execution:", logError);
    }

    // Выполняем SQL через RPC функцию (должна быть защищена RLS в БД)
    // RPC функция execute_sql должна проверять права пользователя через RLS
    const { data, error } = await supabase.rpc("execute_sql", { sql_text });

    if (error) {
      return new Response(JSON.stringify({ success: false, error: error.message }), {
        status: 500,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    return new Response(JSON.stringify({ success: true, data }), {
      status: 200,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  } catch (err: any) {
    return new Response(JSON.stringify({ success: false, error: err?.message || String(err) }), {
      status: 500,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  }
});
