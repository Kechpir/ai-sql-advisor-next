import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface ReviewRequest {
  sql: string;
  schema?: any;
  dialect?: string;
  natural_language_query?: string;
}

serve(async (req) => {
  // Handle CORS
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { sql, schema, dialect = "postgres", natural_language_query }: ReviewRequest = await req.json();

    if (!sql || !sql.trim()) {
      return new Response(
        JSON.stringify({ error: "SQL запрос не указан" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Получаем API ключ OpenAI из секретов
    const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY");
    if (!OPENAI_API_KEY) {
      return new Response(
        JSON.stringify({ error: "OpenAI API ключ не настроен" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Проверяем тариф пользователя (только Light и Pro имеют доступ к Reviewer)
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: "Не авторизован" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const token = authHeader.replace("Bearer ", "");
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Получаем user_id из токена
    const { data: { user }, error: userError } = await supabase.auth.getUser(token);
    if (userError || !user) {
      return new Response(
        JSON.stringify({ error: "Неверный токен" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Проверяем подписку пользователя
    const { data: subscription, error: subError } = await supabase
      .from("subscriptions")
      .select("plan, status, current_period_end")
      .eq("user_id", user.id)
      .eq("status", "active")
      .gt("current_period_end", new Date().toISOString())
      .maybeSingle();

    if (subError || !subscription) {
      return new Response(
        JSON.stringify({ error: "Подписка не найдена или неактивна. AI SQL Reviewer доступен только для тарифов Light и Pro." }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (subscription.plan !== "light" && subscription.plan !== "pro") {
      return new Response(
        JSON.stringify({ error: `AI SQL Reviewer доступен только для тарифов Light и Pro. Ваш тариф: ${subscription.plan}` }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Формируем промпт для анализа SQL
    const schemaText = schema ? JSON.stringify(schema, null, 2) : undefined;
    const prompt = buildReviewPrompt(sql, schemaText, dialect, natural_language_query);

    // Вызываем OpenAI API
    const reviewResult = await callOpenAI(prompt, OPENAI_API_KEY);

    return new Response(
      JSON.stringify({
        review: reviewResult,
        reviewed_at: new Date().toISOString(),
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: any) {
    console.error("[sql_reviewer] Ошибка:", error);
    return new Response(
      JSON.stringify({ error: error.message || "Внутренняя ошибка сервера" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

function buildReviewPrompt(sql: string, schemaText: string | undefined, dialect: string, naturalLanguageQuery?: string): string {
  const parts = [
    "Ты SQL-консультант. Дай ОДНО-ДВА ПРЕДЛОЖЕНИЯ с практичной подсказкой, если запрос может упустить данные или имеет проблемы.",
    "",
    "Сфокусируйся на:",
    "- Потеря данных (NULL значения, неправильные JOIN'ы)",
    "- Неполные результаты из-за фильтров",
    "",
    `Диалект: ${dialect}`,
  ];

  if (schemaText) {
    parts.push("");
    parts.push("Схема БД:");
    parts.push(schemaText.substring(0, 500)); // Ограничиваем размер схемы
  }

  if (naturalLanguageQuery) {
    parts.push("");
    parts.push(`Задача: "${naturalLanguageQuery}"`);
  }

  parts.push("");
  parts.push("SQL:");
  parts.push(sql);
  parts.push("");
  parts.push("Ответь ТОЛЬКО 1-2 предложениями. Если запрос нормальный, ответь 'OK'.");

  return parts.join("\n");
}

async function callOpenAI(prompt: string, apiKey: string): Promise<string> {
  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${apiKey}`,
    },
      body: JSON.stringify({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content: "Ты SQL-консультант. Отвечай ТОЛЬКО 1-2 предложениями с практичной подсказкой. БЕЗ заголовков, списков, markdown. Если запрос нормальный - ответь 'OK'.",
        },
        {
          role: "user",
          content: prompt,
        },
      ],
      temperature: 0.3,
      max_tokens: 80, // Еще больше ограничиваем для краткости
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`OpenAI API error ${response.status}: ${errorText}`);
  }

  const data = await response.json();
  return data.choices[0]?.message?.content || "Не удалось получить ответ от AI";
}

