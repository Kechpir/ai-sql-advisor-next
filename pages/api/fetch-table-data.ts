// pages/api/fetch-table-data.ts
// ⚠️ ТЕСТОВЫЙ ENDPOINT - ТОЛЬКО ДЛЯ РАЗРАБОТКИ
import type { NextApiRequest, NextApiResponse } from "next";
import { securityMiddleware } from '@/lib/middleware';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  // Блокируем в production (только для разработки)
  if (process.env.NODE_ENV === 'production') {
    return res.status(404).json({ error: "Endpoint не найден" });
  }

  // Используем securityMiddleware для защиты
  const { authorized, userId } = await securityMiddleware(req, res, {
    requireAuth: true,
    requireSubscription: 'free',
    allowedMethods: ['POST', 'OPTIONS']
  });

  if (!authorized || !userId) {
    return; // Ответ уже отправлен middleware
  }

  const { table } = req.body;

  // Фейковые данные для теста
  const mockData: Record<string, any[]> = {
    users: [
      { id: 1, name: "Alice", email: "alice@example.com" },
      { id: 2, name: "Bob", email: "bob@example.com" },
    ],
    orders: [
      { id: 101, user_id: 1, total: 240 },
      { id: 102, user_id: 2, total: 130 },
    ],
    products: [
      { id: "p1", name: "Laptop", price: 1200 },
      { id: "p2", name: "Mouse", price: 25 },
    ],
  };

  // Проверяем, есть ли таблица
  if (!table || !mockData[table]) {
    return res.status(400).json({ error: "Таблица не найдена" });
  }

  // Возвращаем данные
  return res.status(200).json({
    table,
    rows: mockData[table],
  });
}
