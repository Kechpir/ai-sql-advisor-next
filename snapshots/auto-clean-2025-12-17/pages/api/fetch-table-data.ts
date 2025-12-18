// pages/api/fetch-table-data.ts
import type { NextApiRequest, NextApiResponse } from "next";

export default function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Метод не поддерживается" });
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
