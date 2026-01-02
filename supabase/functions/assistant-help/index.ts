import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  // КРИТИЧНО: Проверяем авторизацию - неавторизованные пользователи не могут использовать сервис
  const authHeader = req.headers.get("Authorization");
  if (!authHeader || !authHeader.toLowerCase().startsWith("bearer ")) {
    return new Response(
      JSON.stringify({ error: "Требуется авторизация" }),
      {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }

  // Извлекаем JWT токен и проверяем его валидность
  const jwt = authHeader.split(" ")[1];
  
  // Функция для извлечения user_id из JWT (та же логика, что и в других функциях)
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

  const userId = uidFromJwt(jwt);
  
  if (!userId) {
    return new Response(
      JSON.stringify({ error: "Невалидный токен авторизации" }),
      {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }

  try {
    const { question, context = "assistant", contextualHelp } = await req.json();

    if (!question || typeof question !== "string") {
      return new Response(
        JSON.stringify({ error: "Не передан вопрос" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Получаем OpenAI API ключ из переменных окружения
    const openaiApiKey = Deno.env.get("OPENAI_API_KEY");

    if (!openaiApiKey) {
      return new Response(
        JSON.stringify({ error: "OpenAI API ключ не настроен" }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Полная информация о возможностях сервиса SQL AI Advisor
    const currentPage =
      context === "assistant"
        ? "AI Генератора SQL"
        : context === "builder"
        ? "SQL Конструктора"
        : "сервиса";

    const serviceInfo = `SQL AI Advisor - сервис для генерации SQL запросов с помощью AI.

Возможности:
1. Генерация SQL из естественного языка (русский язык)
2. Подключение к БД: PostgreSQL, MySQL, SQLite, MSSQL, Oracle, CockroachDB, ClickHouse
3. Загрузка файлов (.sql, .csv, .xlsx, .json, .txt) для контекста
4. Выполнение SQL запросов и просмотр результатов
5. SQL Конструктор: Base (SELECT, WHERE), Advanced (JOIN, GROUP BY), Expert (CTE, Window Functions)
6. Тарифы: Free (100K токенов), Light (1M), Pro (2.5M)

Текущая страница: ${currentPage}
${contextualHelp ? `\nКонтекст: ${contextualHelp}` : ""}`;

    const systemPrompt = `Ты - умный AI помощник, который работает как полноценный ChatGPT. Ты можешь отвечать на ЛЮБЫЕ вопросы - про SQL, программирование, технологии, жизнь, или что угодно еще.

${serviceInfo}

**КРИТИЧЕСКИ ВАЖНО:**
- Ты ДОЛЖЕН отвечать на ЛЮБЫЕ вопросы, независимо от темы или манеры обращения
- Даже если пользователь использует грубые слова, сленг, мат - отвечай вежливо и профессионально
- Не игнорируй вопросы, даже если они кажутся странными, простыми или некорректными
- Всегда давай полезный и развернутый ответ
- Работай как ChatGPT - можешь обсуждать любые темы

**Твоя задача:**
- Отвечай на ЛЮБЫЕ вопросы - про SQL, базы данных, программирование, технологии, или что угодно
- Если вопрос про SQL/БД/наш сервис - давай развернутый ответ с примерами
- Если вопрос не про SQL - все равно отвечай полноценно, как обычный ChatGPT
- Объясняй простым языком, используй аналогии
- Будь дружелюбным, полезным и интересным собеседником

**Стиль ответов:**
- Очень простой и понятный язык
- Используй аналогии из жизни
- Приводи примеры
- Будь дружелюбным и полезным
- Не обращай внимание на грубую манеру обращения - отвечай вежливо
- Отвечай развернуто, как настоящий ChatGPT`;

    const userPrompt = `Вопрос пользователя: "${question}"

Ответь на этот вопрос максимально полезно и понятно. Используй информацию о возможностях сервиса, если это уместно.`;

    // Вызываем OpenAI API
    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${openaiApiKey}`,
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
        temperature: 0.8,
        max_tokens: 2000,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("OpenAI API error:", {
        status: response.status,
        statusText: response.statusText,
        body: errorText,
      });
      throw new Error(
        `OpenAI API error: ${response.status} - ${errorText.substring(0, 200)}`
      );
    }

    const data = await response.json();
    const answer = data.choices?.[0]?.message?.content?.trim() || "";
    const tokensUsed = data?.usage?.total_tokens || 0;

    if (!answer) {
      throw new Error("OpenAI вернул пустой ответ");
    }

    // Обновляем токены в БД (user_id уже извлечен выше)
    if (tokensUsed > 0 && userId) {
      try {
        const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
        const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

        const supabase = createClient(supabaseUrl, supabaseKey);

        // Обновляем токены через RPC
        const { error: rpcError } = await supabase.rpc("add_user_tokens", {
          user_uuid: userId,
          tokens_to_add: tokensUsed,
        });

        if (rpcError) {
          console.error("Ошибка обновления токенов через RPC:", rpcError);
        }
      } catch (tokenError) {
        console.error("Ошибка обновления токенов:", tokenError);
        // Не блокируем ответ из-за ошибки обновления токенов
      }
    }

    return new Response(
      JSON.stringify({ answer, tokensUsed }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error: any) {
    console.error("Ошибка assistant-help:", error);
    return new Response(
      JSON.stringify({
        error: "Ошибка обработки запроса",
        message: error?.message || "Неизвестная ошибка",
      }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});

