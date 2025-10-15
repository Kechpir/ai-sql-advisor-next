// supabase/functions/schemas/index.ts
import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const BUCKET = "schemas";

const json = (d: unknown, s=200) => new Response(JSON.stringify(d), {status:s, headers:{"content-type":"application/json; charset=utf-8"}});
const bad = (m="bad_request") => json({error:m},400);
const unauth = (m="unauthorized") => json({error:m},401);

function b64url(s:string){s=s.replace(/-/g,"+").replace(/_/g,"/");const p=s.length%4; if(p) s+="=".repeat(4-p); return atob(s)}
function uidFromJwt(jwt:string){ try{ const [,_p]=jwt.split("."); const payload=JSON.parse(new TextDecoder().decode(Uint8Array.from(b64url(_p), c=>c.charCodeAt(0)))); return payload?.sub||null }catch{ return null }}

serve(async (req) => {
  const auth = req.headers.get("authorization") || req.headers.get("Authorization");
  if (!auth?.toLowerCase().startsWith("bearer ")) return unauth();
  const jwt = auth.split(" ")[1];
  const uid = uidFromJwt(jwt); if (!uid) return unauth("invalid_jwt");

  // Все операции выполняем под JWT пользователя → RLS применится автоматически
  const userClient = createClient(SUPABASE_URL, "anon", { global: { headers: { Authorization: `Bearer ${jwt}` }}});

  const url = new URL(req.url);
  const method = req.method.toUpperCase();
  const op = url.searchParams.get("op") ?? "help";

  try {
    if (method==="GET" && op==="list") {
      const { data, error } = await userClient.storage.from(BUCKET).list(`${uid}/`, { limit:200, offset:0 });
      if (error) return json({error:error.message},500);
      return json({ items:(data??[]).filter(f=>f.name.endsWith(".json")).map(f=>f.name.replace(/\.json$/,"")) });
    }

    if (method==="GET" && op==="get") {
      const name = url.searchParams.get("name"); if (!name) return bad("name_required");
      const { data, error } = await userClient.storage.from(BUCKET).download(`${uid}/${name}.json`);
      if (error) return json({error:error.message},404);
      return json({ name, schema: JSON.parse(await data.text()) });
    }

    if (method==="POST" && op==="save") {
      const body = await req.json().catch(()=>({}));
      const name = body?.name; const schema = body?.schema;
      if (!name || !schema) return bad("name_and_schema_required");
      const bytes = new TextEncoder().encode(JSON.stringify(schema));
      const { error } = await userClient.storage.from(BUCKET).upload(`${uid}/${name}.json`, bytes, { contentType:"application/json; charset=utf-8", upsert:true } as any);
      if (error) return json({error:error.message},500);
      return json({ ok:true });
    }

    if (method==="POST" && op==="rename") {
      const body = await req.json().catch(()=>({}));
      const from = body?.oldName; const to = body?.newName;
      if (!from || !to) return bad("oldName_and_newName_required");
      const { error } = await userClient.storage.from(BUCKET).move(`${uid}/${from}.json`, `${uid}/${to}.json`);
      if (error) return json({error:error.message},400);
      return json({ ok:true });
    }

    if (method==="DELETE" && op==="delete") {
      const name = url.searchParams.get("name"); if (!name) return bad("name_required");
      const { error } = await userClient.storage.from(BUCKET).remove([`${uid}/${name}.json`]);
      if (error) return json({error:error.message},400);
      return json({ ok:true });
    }

    return json({ ok:true, ops:["list(GET)","get(GET)","save(POST)","rename(POST)","delete(DELETE)"], note:"Paths are forced to schemas/<auth.uid()>/<name>.json" });
  } catch (e) {
    return json({ error:"unhandled", detail:String(e) }, 500);
  }
});
