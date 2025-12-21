import type { NextApiRequest, NextApiResponse } from "next";
import { Client } from "pg";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Метод не поддерживается" });
  }

  try {
    const { connectionString } = req.body;

    if (!connectionString || typeof connectionString !== "string") {
      return res.status(400).json({ error: "Не передана строка подключения" });
    }

    const client = new Client({ connectionString });
    await client.connect();
    await client.query("SELECT 1");
    await client.end();

    return res.status(200).json({ success: true, message: "Подключение успешно" });
  } catch (err: any) {
    console.error("Ошибка подключения:", err);
    return res.status(500).json({ success: false, error: err.message });
  }
}
