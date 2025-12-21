// @ts-nocheck
// supabase/functions/schemas/index.ts
// Управление схемами БД пользователей с проверкой авторизации и подписки

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
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS, DELETE",
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
function validateSchemaName(name: string): boolean {
  if (!name || typeof name !== "string") return false;
  if (!/^[a-zA-Z0-9_-]+$/.test(name)) return false;
  if (name.length > 100) return false;
  if (name.includes("..") || name.includes("/")) return false;
  return true;
}

const MAX_SCHEMA_SIZE = 10 * 1024 * 1024; // 10MB

// ===== Utils =====
function checksum(input: string): string {
  let h = 0;
  for (let i = 0; i < input.length; i++) {
    h = ((h << 5) - h) + input.charCodeAt(i);
    h |= 0;
  }
  return ("00000000" + (h >>> 0).toString(16)).slice(-8);
}

function diffSchemas(a: any, b: any) {
  const d = { added: [], removed: [], changed: [] };
  const A = Object.keys(a?.tables || {});
  const B = Object.keys(b?.tables || {});
  for (const t of B) if (!A.includes(t)) d.added.push({ table: t });
  for (const t of A) if (!B.includes(t)) d.removed.push({ table: t });
  for (const t of B) {
    if (A.includes(t)) {
      const ac = (a.tables[t]?.columns || []).map((c: any) => c.name);
      const bc = (b.tables[t]?.columns || []).map((c: any) => c.name);
      const add = bc.filter((x: string) => !ac.includes(x));
      const rem = ac.filter((x: string) => !bc.includes(x));
      if (add.length || rem.length) d.changed.push({ table: t, addedCols: add, removedCols: rem });
    }
  }
  return d;
}

// ===== Main Handler =====
Deno.serve(async (req) => {
  const origin = req.headers.get("origin");
  const cors = getCorsHeaders(origin);
  
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: cors });
  }

  try {
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
    if (!SUPABASE_URL) {
      return new Response(JSON.stringify({ error: "Missing SUPABASE_URL" }), {
        status: 500,
        headers: { "Content-Type": "application/json", ...cors },
      });
    }

    // Проверка авторизации
    const auth = await verifyAuth(req);
    if (!auth) {
      return new Response(JSON.stringify({ error: "unauthorized" }), {
        status: 401,
        headers: { "Content-Type": "application/json", ...cors },
      });
    }

    const { uid, jwt } = auth;
    const { createClient } = await import("https://esm.sh/@supabase/supabase-js@2.47.7");
    const sb = createClient(SUPABASE_URL, "anon", {
      auth: { persistSession: false },
      global: { headers: { Authorization: `Bearer ${jwt}` } },
    });

    // Проверка подписки
    const subscription = await checkSubscription(sb, uid);
    if (!subscription.active) {
      return new Response(JSON.stringify({ error: "Subscription required" }), {
        status: 403,
        headers: { "Content-Type": "application/json", ...cors },
      });
    }

    const bucket = "schemas";

    // GET - список схем
    if (req.method === "GET") {
      const { data, error } = await sb.storage.from(bucket).list(`${uid}/`, {
        sortBy: { column: "updated_at", order: "desc" },
      });
      if (error) throw error;
      const items = (data || [])
        .filter((x) => x.name?.endsWith(".json"))
        .map((x) => ({
          name: x.name.replace(/\.json$/i, ""),
          updated_at: x.updated_at,
          size: x.size ?? null,
        }));
      return new Response(JSON.stringify({ items }), {
        status: 200,
        headers: { "Content-Type": "application/json", ...cors },
      });
    }

    if (req.method !== "POST" && req.method !== "DELETE") {
      return new Response(JSON.stringify({ error: "Use GET, POST or DELETE" }), {
        status: 405,
        headers: { "Content-Type": "application/json", ...cors },
      });
    }

    const body = req.method === "POST" ? await req.json().catch(() => ({})) : {};
    const op = body?.op;

    // POST save - сохранение схемы
    if (req.method === "POST" && op === "save") {
      const { name, schema, dialect = "postgres" } = body || {};
      
      // Валидация
      if (!name || typeof schema !== "object") {
        return new Response(JSON.stringify({ error: "Invalid 'name' or 'schema'" }), {
          status: 400,
          headers: { "Content-Type": "application/json", ...cors },
        });
      }

      if (!validateSchemaName(name)) {
        return new Response(JSON.stringify({ error: "Invalid schema name" }), {
          status: 400,
          headers: { "Content-Type": "application/json", ...cors },
        });
      }

      const schemaStr = JSON.stringify(schema);
      if (schemaStr.length > MAX_SCHEMA_SIZE) {
        return new Response(JSON.stringify({ error: "Schema too large" }), {
          status: 400,
          headers: { "Content-Type": "application/json", ...cors },
        });
      }

      // Проверка лимита схем по тарифу
      const { data: existing } = await sb.storage.from(bucket).list(`${uid}/`);
      const limit = subscription.plan === "pro" ? 100 : subscription.plan === "team" ? 500 : 10;
      if (existing && existing.length >= limit) {
        return new Response(JSON.stringify({ error: "Schema limit reached" }), {
          status: 403,
          headers: { "Content-Type": "application/json", ...cors },
        });
      }

      const meta = {
        name,
        dialect,
        updated_at: new Date().toISOString(),
        checksum: checksum(schemaStr),
      };
      const blob = new Blob([JSON.stringify({ meta, schema }, null, 2)], {
        type: "application/json",
      });
      const path = `${uid}/${name}.json`;
      const { error } = await sb.storage.from(bucket).upload(path, blob, {
        upsert: true,
        contentType: "application/json; charset=utf-8",
      });
      if (error) throw error;
      return new Response(JSON.stringify({ ok: true, meta }), {
        status: 200,
        headers: { "Content-Type": "application/json", ...cors },
      });
    }

    // DELETE - удаление схемы
    if (req.method === "DELETE" || (req.method === "POST" && op === "delete")) {
      const name = req.method === "DELETE"
        ? new URL(req.url).searchParams.get("name")
        : body?.name;
      if (!name) {
        return new Response(JSON.stringify({ error: "Field 'name' required" }), {
          status: 400,
          headers: { "Content-Type": "application/json", ...cors },
        });
      }

      if (!validateSchemaName(name)) {
        return new Response(JSON.stringify({ error: "Invalid schema name" }), {
          status: 400,
          headers: { "Content-Type": "application/json", ...cors },
        });
      }

      const { error } = await sb.storage.from(bucket).remove([`${uid}/${name}.json`]);
      if (error) throw error;
      return new Response(JSON.stringify({ deleted: name }), {
        status: 200,
        headers: { "Content-Type": "application/json", ...cors },
      });
    }

    // POST diff - сравнение схем
    if (req.method === "POST" && op === "diff") {
      const { name, new_schema } = body || {};
      
      if (!validateSchemaName(name)) {
        return new Response(JSON.stringify({ error: "Invalid schema name" }), {
          status: 400,
          headers: { "Content-Type": "application/json", ...cors },
        });
      }

      const { data, error } = await sb.storage.from(bucket).download(`${uid}/${name}.json`);
      if (error || !data) {
        return new Response(JSON.stringify({ error: "Schema not found" }), {
          status: 404,
          headers: { "Content-Type": "application/json", ...cors },
        });
      }
      const old = JSON.parse(await data.text());
      const diff = diffSchemas(old?.schema || {}, new_schema || {});
      return new Response(JSON.stringify({ diff }), {
        status: 200,
        headers: { "Content-Type": "application/json", ...cors },
      });
    }

    // POST update - обновление схемы
    if (req.method === "POST" && op === "update") {
      const { name, new_schema } = body || {};
      
      if (!validateSchemaName(name)) {
        return new Response(JSON.stringify({ error: "Invalid schema name" }), {
          status: 400,
          headers: { "Content-Type": "application/json", ...cors },
        });
      }

      const path = `${uid}/${name}.json`;
      const cur = await sb.storage.from(bucket).download(path);
      if (cur.error || !cur.data) {
        return new Response(JSON.stringify({ error: "Schema not found" }), {
          status: 404,
          headers: { "Content-Type": "application/json", ...cors },
        });
      }
      const old = JSON.parse(await cur.data.text());
      const oldC = old?.meta?.checksum;
      const newStr = JSON.stringify(new_schema || {});
      const newC = checksum(newStr);
      if (newC === oldC) {
        return new Response(JSON.stringify({ updated: false, reason: "Изменений не обнаружено." }), {
          status: 200,
          headers: { "Content-Type": "application/json", ...cors },
        });
      }

      if (newStr.length > MAX_SCHEMA_SIZE) {
        return new Response(JSON.stringify({ error: "Schema too large" }), {
          status: 400,
          headers: { "Content-Type": "application/json", ...cors },
        });
      }

      const meta = { name, updated_at: new Date().toISOString(), checksum: newC };
      const blob = new Blob([JSON.stringify({ meta, schema: new_schema }, null, 2)], {
        type: "application/json",
      });
      const up = await sb.storage.from(bucket).upload(path, blob, {
        upsert: true,
        contentType: "application/json; charset=utf-8",
      });
      if (up.error) throw up.error;
      return new Response(JSON.stringify({ updated: true, reason: "Схема обновлена.", meta }), {
        status: 200,
        headers: { "Content-Type": "application/json", ...cors },
      });
    }

    // POST get - получение схемы
    if (req.method === "POST" && op === "get") {
      const { name } = body || {};
      
      if (!validateSchemaName(name)) {
        return new Response(JSON.stringify({ error: "Invalid schema name" }), {
          status: 400,
          headers: { "Content-Type": "application/json", ...cors },
        });
      }

      const dl = await sb.storage.from(bucket).download(`${uid}/${name}.json`);
      if (dl.error) throw dl.error;
      const file = JSON.parse(await dl.data.text());
      return new Response(JSON.stringify(file), {
        status: 200,
        headers: { "Content-Type": "application/json", ...cors },
      });
    }

    return new Response(JSON.stringify({ error: `Unknown op: ${op}` }), {
      status: 400,
      headers: { "Content-Type": "application/json", ...cors },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: String(e?.message || e) }), {
      status: 500,
      headers: { "Content-Type": "application/json", ...cors },
    });
  }
});
