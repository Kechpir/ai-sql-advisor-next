import type { NextApiRequest, NextApiResponse } from "next";
import { GoogleGenerativeAI } from "@google/generative-ai";

// CORS заголовки
function setCorsHeaders(res: NextApiResponse, origin: string | undefined) {
  const allowedOrigins = [
    'https://ai-sql-advisor.vercel.app',
    'https://ai-sql-advisor-next-stage.vercel.app',
    'http://localhost:3000',
    'http://localhost:3001'
  ];
  
  const originHeader = origin && allowedOrigins.includes(origin) ? origin : allowedOrigins[0];
  
  res.setHeader('Access-Control-Allow-Origin', originHeader);
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const origin = req.headers.origin;
  setCorsHeaders(res, origin);
  
  // Обработка preflight запросов
  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }
  
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Метод не поддерживается (требуется POST)" });
  }

  // Проверяем наличие API ключа Gemini
  const geminiApiKey = process.env.GEMINI_API_KEY?.trim();
  if (!geminiApiKey) {
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    return res.status(500).json({ 
      error: "GEMINI_API_KEY не настроен в .env.local",
      hint: "Добавьте GEMINI_API_KEY в .env.local файл"
    });
  }

  // Безопасное чтение тела запроса
  let body;
  try {
    body = req.body;
    if (!body && req.method === 'POST') {
      return res.status(400).json({ error: "Не удалось прочитать тело запроса" });
    }
  } catch (e) {
    console.error("Ошибка чтения тела запроса:", e);
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    return res.status(400).json({ error: "Ошибка парсинга тела запроса" });
  }

  const { nl, schema, dialect = "postgres" } = body || {};

  if (!nl || !schema) {
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    return res.status(400).json({ error: "Не переданы nl (запрос) или schema (схема БД)" });
  }

  try {
    // Сериализуем схему в текст
    let schemaText: string;
    try {
      schemaText = typeof schema === 'string' ? schema : JSON.stringify(schema, null, 2);
    } catch (e) {
      console.error("Ошибка сериализации схемы:", e);
      res.setHeader('Content-Type', 'application/json; charset=utf-8');
      return res.status(400).json({ error: "Неверный формат схемы БД" });
    }

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

    // Инициализируем Gemini API
    const genAI = new GoogleGenerativeAI(geminiApiKey);
    const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

    console.log('[test-gemini] Отправка запроса к Gemini API...');
    const startTime = Date.now();

    // Вызываем Gemini API
    const result = await model.generateContent(prompt);
    const response = await result.response;
    const sql = response.text().trim();

    const endTime = Date.now();
    const duration = endTime - startTime;

    console.log(`[test-gemini] Ответ получен за ${duration}ms`);

    if (!sql) {
      throw new Error("Gemini не вернул SQL запрос");
    }

    // Получаем информацию об использовании токенов
    const usageMetadata = result.response.usageMetadata;
    const tokensUsed = usageMetadata?.totalTokenCount || 0;
    const promptTokens = usageMetadata?.promptTokenCount || 0;
    const candidatesTokens = usageMetadata?.candidatesTokenCount || 0;

    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    return res.status(200).json({
      sql,
      usage: {
        total_tokens: tokensUsed,
        prompt_tokens: promptTokens,
        completion_tokens: candidatesTokens,
      },
      tokens_used: tokensUsed,
      model: "gemini-1.5-flash",
      duration_ms: duration,
      provider: "gemini",
      blocked: false,
    });

  } catch (error: any) {
    console.error("[test-gemini] Ошибка:", error);
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    return res.status(500).json({
      error: error.message || "Ошибка генерации SQL через Gemini",
      provider: "gemini",
    });
  }
}

