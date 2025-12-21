// Общие утилиты для авторизации и проверки подписки
// supabase/functions/_shared/auth.ts

const ALLOWED_ORIGINS = [
  'https://ai-sql-advisor.vercel.app',
  'https://ai-sql-advisor-next-stage.vercel.app',
  'http://localhost:3000',
  'http://localhost:3001'
];

export function getCorsHeaders(origin: string | null) {
  const allowedOrigin = origin && ALLOWED_ORIGINS.includes(origin) 
    ? origin 
    : ALLOWED_ORIGINS[0];
  
  return {
    "Access-Control-Allow-Origin": allowedOrigin,
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS, DELETE",
  };
}

export function b64u(s: string): string {
  s = s.replace(/-/g, "+").replace(/_/g, "/");
  const p = s.length % 4;
  if (p) s += "=".repeat(4 - p);
  const b = atob(s);
  const a = new Uint8Array(b.length);
  for (let i = 0; i < b.length; i++) a[i] = b.charCodeAt(i);
  return new TextDecoder().decode(a);
}

export function uidFromJwt(jwt: string | null): string | null {
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

export async function verifyAuth(req: Request): Promise<{ uid: string; jwt: string } | null> {
  const auth = req.headers.get("authorization") || req.headers.get("Authorization");
  if (!auth || !auth.toLowerCase().startsWith("bearer ")) {
    return null;
  }
  
  const jwt = auth.split(" ")[1];
  const uid = uidFromJwt(jwt);
  
  if (!uid) {
    return null;
  }
  
  return { uid, jwt };
}

export async function checkSubscription(
  supabase: any,
  userId: string
): Promise<{ active: boolean; plan?: string }> {
  try {
    const { data, error } = await supabase
      .from("subscriptions")
      .select("plan, status, current_period_end")
      .eq("user_id", userId)
      .eq("status", "active")
      .gt("current_period_end", new Date().toISOString())
      .single();
    
    if (error || !data) {
      return { active: false };
    }
    
    return { active: true, plan: data.plan };
  } catch {
    return { active: false };
  }
}

export function unauthorizedResponse(corsHeaders: Record<string, string>) {
  return new Response(
    JSON.stringify({ error: "unauthorized" }),
    {
      status: 401,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    }
  );
}

export function forbiddenResponse(corsHeaders: Record<string, string>, message = "Subscription required") {
  return new Response(
    JSON.stringify({ error: message }),
    {
      status: 403,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    }
  );
}
