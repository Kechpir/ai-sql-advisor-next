// @ts-nocheck
// supabase/functions/fetch_schema/index.ts
// Edge Function (Deno). Читает схему таблиц из PostgreSQL по db_url (read-only)
// С проверкой авторизации, подписки и валидации db_url

import { Client } from "https://deno.land/x/postgres@v0.17.2/mod.ts";

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

// ===== Validation =====
function validateDbUrl(url: string): { valid: boolean; error?: string } {
  if (!url || typeof url !== "string") {
    return { valid: false, error: "db_url is required" };
  }
  
  // Только PostgreSQL
  if (!url.startsWith("postgres://") && !url.startsWith("postgresql://")) {
    return { valid: false, error: "Only PostgreSQL connections are supported" };
  }
  
  // Запретить localhost/127.0.0.1 (SSRF защита)
  if (url.includes("localhost") || url.includes("127.0.0.1") || url.includes("0.0.0.0")) {
    return { valid: false, error: "Localhost connections are not allowed" };
  }
  
  // Запретить внутренние сети (SSRF защита)
  if (url.includes("10.") || url.includes("192.168.") || url.includes("172.16.")) {
    return { valid: false, error: "Private network connections are not allowed" };
  }
  
  return { valid: true };
}

async function verifyDbUrlOwnership(sb: any, userId: string, dbUrl: string): Promise<boolean> {
  try {
    // Получаем все подключения пользователя
    const { data: connections, error } = await sb
      .from("user_connections")
      .select("connection_string_encrypted")
      .eq("user_id", userId);
    
    if (error || !connections) return false;
    
    // TODO: Расшифровать и сравнить с dbUrl
    // Пока что разрешаем, если есть хотя бы одно подключение
    // В будущем нужно добавить шифрование/дешифрование
    return connections.length > 0;
  } catch {
    return false;
  }
}

function badRequest(msg: string, corsHeaders: Record<string, string>) {
  return new Response(
    JSON.stringify({ error: msg }),
    {
      status: 400,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    }
  );
}

// ===== Main Handler =====
Deno.serve(async (req) => {
  const origin = req.headers.get("origin");
  const corsHeaders = getCorsHeaders(origin);

  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Use POST" }), {
      status: 405,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  }

  try {
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
    const sb = createClient(SUPABASE_URL, "anon", {
      global: { headers: { Authorization: `Bearer ${jwt}` } },
    });

    // Проверка подписки
    const subscription = await checkSubscription(sb, uid);
    if (!subscription.active) {
      return new Response(JSON.stringify({ error: "Subscription required" }), {
        status: 403,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    // Parse body
    let payload;
    try {
      payload = await req.json();
    } catch {
      return badRequest("Invalid JSON body", corsHeaders);
    }

    const dbUrl = payload?.db_url?.trim();
    if (!dbUrl) {
      return badRequest("Field 'db_url' is required", corsHeaders);
    }

    // Валидация db_url
    const urlValidation = validateDbUrl(dbUrl);
    if (!urlValidation.valid) {
      return new Response(JSON.stringify({ error: urlValidation.error }), {
        status: 400,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    // Проверка принадлежности db_url пользователю
    const isOwner = await verifyDbUrlOwnership(sb, uid, dbUrl);
    if (!isOwner) {
      return new Response(JSON.stringify({ error: "Connection not found or access denied" }), {
        status: 403,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    const schema = (payload?.schema || "public").trim();
    const maxTables = Math.min(Math.max(Number(payload?.maxTables || 200), 1), 2000);

    const client = new Client(dbUrl);
    try {
      await client.connect();
      // Secure read-only session
      await client.queryArray("BEGIN READ ONLY");
      await client.queryArray("SET LOCAL statement_timeout = '5s'");
      await client.queryArray("SET LOCAL search_path = pg_catalog, information_schema");

      // Safety gate - всегда требовать catalog-only роль
      const gate = await client.queryObject(`
        SELECT EXISTS (
          SELECT 1
          FROM information_schema.tables t
          WHERE t.table_schema NOT IN ('pg_catalog','information_schema','pg_toast')
            AND has_table_privilege(
              current_user,
              quote_ident(t.table_schema) || '.' || quote_ident(t.table_name),
              'SELECT'
            )
        ) AS has_select;
      `);

      // Всегда требовать catalog-only (нельзя отключить)
      if (gate.rows[0]?.has_select) {
        await client.end();
        return new Response(
          JSON.stringify({
            blocked: true,
            code: "ROLE_NOT_CATALOG_ONLY",
            reason: "Подключённый пользователь имеет доступ к данным. Используйте роль без SELECT на пользовательские таблицы (catalog-only).",
          }),
          {
            status: 403,
            headers: { "Content-Type": "application/json", ...corsHeaders },
          }
        );
      }

      // Таблицы
      const tablesRes = await client.queryObject`
        SELECT table_name
        FROM information_schema.tables
        WHERE table_schema = ${schema}
          AND table_type = 'BASE TABLE'
        ORDER BY table_name
        LIMIT ${maxTables};
      `;
      const tableNames = tablesRes.rows.map((r: any) => r.table_name);

      if (tableNames.length === 0) {
        await client.end();
        return new Response(
          JSON.stringify({
            schema,
            tables: {},
            countTables: 0,
          }),
          {
            status: 200,
            headers: { "Content-Type": "application/json", ...corsHeaders },
          }
        );
      }

      // Колонки
      const columnsRes = await client.queryObject`
        SELECT table_name, column_name, data_type, is_nullable
        FROM information_schema.columns
        WHERE table_schema = ${schema}
          AND table_name = ANY(${tableNames})
        ORDER BY table_name, ordinal_position;
      `;

      // PK
      const pksRes = await client.queryObject`
        SELECT tc.table_name, kcu.column_name
        FROM information_schema.table_constraints AS tc
        JOIN information_schema.key_column_usage AS kcu
          ON tc.constraint_name = kcu.constraint_name
         AND tc.table_schema = kcu.table_schema
        WHERE tc.constraint_type = 'PRIMARY KEY'
          AND tc.table_schema = ${schema}
          AND tc.table_name = ANY(${tableNames});
      `;

      // FK
      const fksRes = await client.queryObject`
        SELECT
          tc.table_name,
          kcu.column_name,
          ccu.table_name  AS foreign_table_name,
          ccu.column_name AS foreign_column_name
        FROM information_schema.table_constraints AS tc
        JOIN information_schema.key_column_usage AS kcu
          ON tc.constraint_name = kcu.constraint_name
         AND tc.table_schema = kcu.table_schema
        JOIN information_schema.constraint_column_usage AS ccu
          ON ccu.constraint_name = tc.constraint_name
         AND ccu.table_schema = tc.table_schema
        WHERE tc.constraint_type = 'FOREIGN KEY'
          AND tc.table_schema = ${schema}
          AND tc.table_name = ANY(${tableNames});
      `;

      await client.queryArray("COMMIT");
      await client.end();

      // Сборка JSON
      const tables: Record<string, any> = {};
      for (const t of tableNames) {
        tables[t] = {
          columns: [],
          primaryKey: [],
          foreignKeys: [],
        };
      }

      for (const c of columnsRes.rows) {
        tables[c.table_name].columns.push({
          name: c.column_name,
          type: c.data_type,
          nullable: c.is_nullable === "YES",
        });
      }

      for (const pk of pksRes.rows) {
        tables[pk.table_name].primaryKey.push(pk.column_name);
      }

      for (const fk of fksRes.rows) {
        tables[fk.table_name].foreignKeys.push({
          column: fk.column_name,
          ref_table: fk.foreign_table_name,
          ref_column: fk.foreign_column_name,
        });
      }

      const result = {
        dialect: "postgres",
        schema,
        countTables: tableNames.length,
        tables,
      };

      return new Response(JSON.stringify(result), {
        status: 200,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    } catch (e) {
      const msg = typeof e?.message === "string" ? e.message : String(e);
      return new Response(JSON.stringify({ error: msg }), {
        status: 500,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }
  } catch (e) {
    const msg = typeof e?.message === "string" ? e.message : String(e);
    return new Response(JSON.stringify({ error: msg }), {
      status: 500,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  }
});
