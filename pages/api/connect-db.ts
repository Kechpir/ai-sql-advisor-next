import type { NextApiRequest, NextApiResponse } from "next";
import { Client } from "pg";
import { checkAuth, checkConnectionOwnership } from '@/lib/auth';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Метод не поддерживается" });
  }

  try {
    // Проверка авторизации
    const userId = checkAuth(req);
    if (!userId) {
      return res.status(401).json({ error: "Не авторизован" });
    }

    const { connectionString } = req.body;

    if (!connectionString || typeof connectionString !== "string") {
      return res.status(400).json({ error: "Не передана строка подключения" });
    }

    // Получаем JWT токен для передачи в проверку (нужен для RLS)
    const authHeader = req.headers.authorization;
    const jwt = authHeader?.replace(/^Bearer /i, '') || null;
    
    // Проверка принадлежности connection string пользователю
    const isOwner = await checkConnectionOwnership(userId, connectionString, jwt);
    if (!isOwner) {
      return res.status(403).json({ error: "Доступ запрещен: подключение не принадлежит пользователю" });
    }

    const client = new Client({ connectionString });
    await client.connect();
    await client.query("SELECT 1");
    await client.end();

    return res.status(200).json({ success: true, message: "Подключение успешно" });
  } catch (err: any) {
    // НЕ логируем connection strings в ошибках
    console.error("Ошибка подключения:", err.message || "Неизвестная ошибка");
    return res.status(500).json({ success: false, error: err.message });
  }
}
