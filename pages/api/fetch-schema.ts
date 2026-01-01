// /pages/api/fetch-schema.ts
import type { NextApiRequest, NextApiResponse } from "next";
import { Client } from "pg";
import mysql from "mysql2/promise";
import { checkAuth, checkConnectionOwnership } from '@/lib/auth';
import { detectDbType } from '@/lib/db/detectDbType';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  // Оборачиваем весь handler в try-catch для перехвата любых ошибок
  try {
    if (req.method !== "POST") {
      return res.status(405).json({ error: "Метод не поддерживается (требуется POST)" });
    }

    // Проверка авторизации
    const userId = checkAuth(req);
    if (!userId) {
      return res.status(401).json({ error: "Не авторизован" });
    }

    const { connectionString } = req.body;
    if (!connectionString) {
      return res.status(400).json({ error: "Не передан connectionString" });
    }

    // Получаем JWT токен для передачи в проверку (нужен для RLS)
    const authHeader = req.headers.authorization;
    const jwt = authHeader?.replace(/^Bearer /i, '') || null;

    // Проверка принадлежности connection string пользователю
    console.log('[fetch-schema] Проверка принадлежности connection string пользователю...');
    const isOwner = await checkConnectionOwnership(userId, connectionString, jwt);
    if (!isOwner) {
      console.error('[fetch-schema] ❌ Доступ запрещен: подключение не принадлежит пользователю');
      return res.status(403).json({ error: "Доступ запрещен: подключение не принадлежит пользователю" });
    }
    console.log('[fetch-schema] ✅ Подключение принадлежит пользователю, продолжаем...');

    // Автоматически определяем тип БД из строки подключения
    const dbInfo = detectDbType(connectionString);
    const dbType = dbInfo?.type || "postgres";
    
    // НЕ логируем connection strings (безопасность)
    console.log("Получен запрос на получение схемы:", { dbType, displayName: dbInfo?.displayName });

    try {
    const schema: Record<string, string[]> = {};

    // === PostgreSQL ===
    if (dbType === "postgres" || dbType === "postgresql") {
      const client = new Client({ connectionString });
      try {
        await client.connect();

        const query = `
          SELECT
            table_name,
            column_name,
            data_type
          FROM information_schema.columns
          WHERE table_schema = 'public'
          ORDER BY table_name, ordinal_position;
        `;

        const result = await client.query(query);
        result.rows.forEach((row) => {
          if (!schema[row.table_name]) schema[row.table_name] = [];
          schema[row.table_name].push(row.column_name);
        });
      } finally {
        try {
          await client.end();
        } catch (closeError) {
          console.error("Ошибка при закрытии соединения PostgreSQL:", closeError);
        }
      }
    }

    // === MySQL / MariaDB ===
    else if (dbType === "mysql" || dbType === "mariadb") {
      const conn = await mysql.createConnection(connectionString);
      try {
        // Получаем список таблиц
        const [tables] = await conn.execute("SHOW TABLES");
        const tableNames = (tables as any[]).map((t: any) => Object.values(t)[0] as string);

        // Для каждой таблицы получаем колонки
        for (const tableName of tableNames) {
          const [columns] = await conn.execute(`SHOW COLUMNS FROM \`${tableName}\``);
          schema[tableName] = (columns as any[]).map((c: any) => c.Field);
        }
      } finally {
        try {
          await conn.end();
        } catch (closeError) {
          console.error(`Ошибка при закрытии соединения ${dbInfo?.displayName || 'MySQL'}:`, closeError);
        }
      }
    }
    
    // === CockroachDB (PostgreSQL совместимый) ===
    else if (dbType === "cockroachdb") {
      const client = new Client({ connectionString });
      try {
        await client.connect();

        const query = `
          SELECT
            table_name,
            column_name,
            data_type
          FROM information_schema.columns
          WHERE table_schema = 'public'
          ORDER BY table_name, ordinal_position;
        `;

        const result = await client.query(query);
        result.rows.forEach((row) => {
          if (!schema[row.table_name]) schema[row.table_name] = [];
          schema[row.table_name].push(row.column_name);
        });
      } finally {
        try {
          await client.end();
        } catch (closeError) {
          console.error("Ошибка при закрытии соединения CockroachDB:", closeError);
        }
      }
    }
    
    // === Неподдерживаемый тип БД ===
    else {
      return res.status(400).json({ 
        success: false, 
        error: `Неподдерживаемый тип базы данных: ${dbInfo?.displayName || dbType}. Поддерживаются: PostgreSQL, MySQL, MariaDB, SQLite, CockroachDB` 
      });
    }

    // === SQLite ===
    else if (dbType === "sqlite") {
      // Динамический импорт для SQLite, так как он может быть проблемным в Next.js
      const sqlite3 = require("sqlite3");
      const { open } = require("sqlite");
      const dbPath = connectionString.replace(/^(sqlite:\/\/|file:)/, "");
      const db = await open({ filename: dbPath, driver: sqlite3.Database });
      try {
        const tables = await db.all("SELECT name FROM sqlite_master WHERE type='table'");
        for (const table of tables) {
          const columns = await db.all(`PRAGMA table_info(\`${table.name}\`)`);
          schema[table.name] = columns.map((c: any) => c.name);
        }
      } finally {
        try {
          await db.close();
        } catch (closeError) {
          console.error("Ошибка при закрытии соединения SQLite:", closeError);
        }
      }
    }

      res.status(200).json({
        success: true,
        schema,
        tables: Object.keys(schema),
      });
    } catch (err: any) {
      console.error("Ошибка при получении схемы:", err);
      const errorMessage = err.message || err.toString() || "Ошибка при подключении к базе данных";
      console.error("Детали ошибки:", {
        message: err.message,
        code: err.code,
        name: err.name,
        stack: err.stack?.substring(0, 500),
        connectionString: connectionString ? connectionString.replace(/:[^:@]+@/, ":****@") : "не указана",
      });
      
      // Проверяем, не был ли ответ уже отправлен
      if (!res.headersSent) {
        res.status(500).json({
          success: false,
          error: errorMessage,
        });
      }
    }
  } catch (handlerError: any) {
    // Перехватываем ошибки на уровне всего handler (например, проблемы с импортами)
    console.error("Критическая ошибка в handler:", handlerError);
    const errorMessage = handlerError.message || handlerError.toString() || "Внутренняя ошибка сервера";
    
    if (!res.headersSent) {
      res.status(500).json({
        success: false,
        error: errorMessage,
      });
    }
  }
}
