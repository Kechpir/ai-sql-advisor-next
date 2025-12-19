import type { NextApiRequest, NextApiResponse } from "next";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Метод не поддерживается (требуется POST)" });
  }

  const { nl, schema, dialect = "postgres" } = req.body;

  if (!nl || !schema) {
    return res.status(400).json({ error: "Не переданы nl (запрос) или schema (схема БД)" });
  }

  const openaiApiKey = process.env.OPENAI_API_KEY;
  if (!openaiApiKey) {
    return res.status(500).json({ 
      error: "OPENAI_API_KEY не настроен. Добавь его в .env.local файл." 
    });
  }

  try {
    // Формируем промпт для OpenAI
    const schemaText = typeof schema === "string" 
      ? schema 
      : JSON.stringify(schema, null, 2);

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

    if (!sql) {
      throw new Error("OpenAI не вернул SQL запрос");
    }

    // Проверяем на опасные операции
    const dangerKeywords = /DROP|DELETE|UPDATE|INSERT|ALTER|TRUNCATE|CREATE|GRANT|REVOKE/i;
    const isDangerous = dangerKeywords.test(sql);

    return res.status(200).json({
      sql,
      blocked: isDangerous,
      withSafety: isDangerous ? `-- ⚠️ Запрос содержит опасные операции. Используй только SELECT:\n${sql}` : null,
    });
  } catch (err: any) {
    console.error("Ошибка генерации SQL:", err);
    return res.status(500).json({
      error: err.message || "Ошибка генерации SQL",
    });
  }
}
