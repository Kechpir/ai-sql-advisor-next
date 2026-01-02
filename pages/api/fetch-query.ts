import type { NextApiRequest, NextApiResponse } from "next";
import { Client as PgClient } from "pg";
import mysql from "mysql2/promise";
import sqlite3 from "sqlite3";
import { open } from "sqlite";
import { jsonToSql } from "@/lib/db/jsonToSql";
import { checkAuth, checkConnectionOwnership } from '@/lib/auth';
import { securityMiddleware } from '@/lib/middleware';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  // Используем security middleware для CORS и авторизации
  const { authorized, userId } = await securityMiddleware(req, res, {
    requireAuth: true,
    requireSubscription: 'free', // Минимальный план для выполнения запросов
    allowedMethods: ['POST', 'OPTIONS']
  });

  if (!authorized || !userId) {
    return; // Ответ уже отправлен middleware
  }

  const { connectionString, query, dbType, ...jsonQuery } = req.body;

  if (!connectionString) {
    return res.status(400).json({ error: "❌ Missing connection string" });
  }

  // Получаем JWT токен для передачи в проверку (нужен для RLS)
  const authHeader = req.headers.authorization;
  const jwt = authHeader?.replace(/^Bearer /i, '') || null;
  
  // Проверка принадлежности connection string пользователю
  const isOwner = await checkConnectionOwnership(userId, connectionString, jwt);
  if (!isOwner) {
    return res.status(403).json({ error: "Доступ запрещен: подключение не принадлежит пользователю" });
  }

  // Автоматически определяем тип БД из connectionString, если не указан
  const { detectDbType } = require('@/lib/db/detectDbType');
  const dbInfo = detectDbType(connectionString);
  let detectedDbType = dbType || dbInfo?.type || "postgres";

  // Генерируем SQL из jsonQuery, если передан объект, иначе используем готовый query
  let sqlQuery = query;
  if (!sqlQuery && jsonQuery.table) {
    sqlQuery = jsonToSql({ ...jsonQuery, dbType: detectedDbType });
  }

  if (!sqlQuery) {
    return res.status(400).json({ error: "❌ Missing SQL query or query parameters" });
  }

  // Валидация SQL запроса (защита от SQL injection)
  const sqlUpper = sqlQuery.trim().toUpperCase();
  if (!sqlUpper.startsWith('SELECT')) {
    return res.status(400).json({ error: "❌ Only SELECT queries are allowed" });
  }

  // Блокируем опасные операции
  const dangerKeywords = /DROP|DELETE|UPDATE|INSERT|ALTER|TRUNCATE|CREATE|GRANT|REVOKE|EXEC|EXECUTE|CALL/i;
  if (dangerKeywords.test(sqlQuery)) {
    return res.status(400).json({ error: "❌ Dangerous operations are not allowed" });
  }

  // Разрешаем безопасные запросы к information_schema для получения метаданных (списки таблиц, колонок)
  // Это нужно для запросов типа "покажи какие таблицы есть в базе"
  const safeInformationSchemaPatterns = [
    /FROM\s+information_schema\.tables/i,
    /FROM\s+information_schema\.columns/i,
    /FROM\s+information_schema\.table_constraints/i,
    /FROM\s+information_schema\.key_column_usage/i,
  ];
  
  const isSafeInformationSchemaQuery = safeInformationSchemaPatterns.some(pattern => 
    pattern.test(sqlQuery)
  ) && 
  // Дополнительная проверка: только простые SELECT без опасных операций
  !/UNION|EXCEPT|INTERSECT|WITH\s+RECURSIVE/i.test(sqlQuery) &&
  // Не должно быть JOIN с другими системными таблицами
  !/JOIN\s+(pg_|mysql\.|sys\.|performance_schema\.)/i.test(sqlQuery);

  // Блокируем доступ к системным таблицам (улучшенная защита от SQL Injection)
  // Проверяем только системные схемы, не блокируем пользовательские таблицы с похожими именами
  // НО: разрешаем безопасные запросы к information_schema для метаданных
  if (!isSafeInformationSchemaQuery) {
    const systemTablePatterns = [
      // Системные схемы PostgreSQL
      /FROM\s+information_schema\./i,
      /FROM\s+pg_catalog\./i,
      /FROM\s+pg_toast\./i,
      /FROM\s+pg_temp\./i,
      /FROM\s+pg_toast_temp\./i,
      // Системные схемы MySQL
      /FROM\s+mysql\./i,
      /FROM\s+performance_schema\./i,
      /FROM\s+sys\./i,
      // То же для JOIN
      /JOIN\s+information_schema\./i,
      /JOIN\s+pg_catalog\./i,
      /JOIN\s+pg_toast\./i,
      /JOIN\s+pg_temp\./i,
      /JOIN\s+pg_toast_temp\./i,
      /JOIN\s+mysql\./i,
      /JOIN\s+performance_schema\./i,
      /JOIN\s+sys\./i,
      // INTO
      /INTO\s+information_schema\./i,
      /INTO\s+pg_catalog\./i,
      /INTO\s+pg_toast\./i,
      /INTO\s+pg_temp\./i,
      /INTO\s+pg_toast_temp\./i,
      /INTO\s+mysql\./i,
      /INTO\s+performance_schema\./i,
      /INTO\s+sys\./i,
    ];
    
    for (const pattern of systemTablePatterns) {
      if (pattern.test(sqlQuery)) {
        return res.status(400).json({ error: "❌ Access to system tables is not allowed" });
      }
    }
  }

  // Дополнительно: блокируем известные опасные системные таблицы PostgreSQL (без схемы)
  // Только самые опасные системные таблицы
  const dangerousSystemTables = [
    'pg_database', 'pg_user', 'pg_shadow', 'pg_authid', 'pg_auth_members',
    'pg_roles', 'pg_settings', 'pg_stat_activity', 'pg_locks'
  ];

  for (const table of dangerousSystemTables) {
    // Проверяем, что это именно системная таблица, а не часть названия пользовательской таблицы
    const regex = new RegExp(`\\bFROM\\s+${table}\\b`, 'i');
    if (regex.test(sqlQuery)) {
      return res.status(400).json({ error: "❌ Access to system tables is not allowed" });
    }
  }

  // Блокируем подозрительные конструкции (улучшенная защита)
  const suspiciousPatterns = [
    /;\s*(DROP|DELETE|UPDATE|INSERT|ALTER|TRUNCATE|CREATE|GRANT|REVOKE)/i, // Множественные запросы с опасными операциями
    /--.*(DROP|DELETE|UPDATE|INSERT|ALTER|TRUNCATE|CREATE|GRANT|REVOKE)/i, // Комментарии с опасными операциями
    /\/\*.*(DROP|DELETE|UPDATE|INSERT|ALTER|TRUNCATE|CREATE|GRANT|REVOKE).*\*\//i, // Многострочные комментарии
  ];
  
  for (const pattern of suspiciousPatterns) {
    if (pattern.test(sqlQuery)) {
      return res.status(400).json({ error: "❌ Suspicious SQL pattern detected" });
    }
  }

  // Максимальная длина запроса (защита от DoS)
  if (sqlQuery.length > 100000) {
    return res.status(400).json({ error: "❌ SQL query is too long (max 100KB)" });
  }

  // Очистка от мульти-запросов (берем только первый до ;)
  // Драйверы pg и mysql2 могут вести себя нестабильно с мульти-запросами
  const firstQuery = sqlQuery.split(';').filter((s: string) => s.trim()).length > 0 
    ? sqlQuery.split(';').filter((s: string) => s.trim())[0].trim() + ';'
    : sqlQuery;

  try {
    let rows: any[] = [];
    let columns: string[] = [];

    // === PostgreSQL ===
    if (detectedDbType === "postgres" || detectedDbType === "postgresql") {
      const client = new PgClient({ connectionString });
      await client.connect();
      // Выполняем только первый запрос для стабильности
      const result = await client.query(firstQuery);
      rows = result.rows || [];
      columns = result.fields ? result.fields.map((f) => f.name) : [];
      await client.end();
    }

    // === MySQL / MariaDB ===
    else if (detectedDbType === "mysql" || detectedDbType === "mariadb") {
      const conn = await mysql.createConnection(connectionString);
      const [result, fields] = await conn.execute(sqlQuery);
      rows = result as any[];
      columns = fields ? fields.map((f: any) => f.name) : [];
      await conn.end();
    }
    
    // === CockroachDB (PostgreSQL совместимый) ===
    else if (detectedDbType === "cockroachdb") {
      const client = new PgClient({ connectionString });
      await client.connect();
      const result = await client.query(firstQuery);
      rows = result.rows || [];
      columns = result.fields ? result.fields.map((f) => f.name) : [];
      await client.end();
    }

    // === SQLite ===
    else if (detectedDbType === "sqlite") {
      const dbPath = connectionString.replace(/^(sqlite:\/\/|file:)/, "");
      const db = await open({ filename: dbPath, driver: sqlite3.Database });
      const result = await db.all(sqlQuery);
      rows = result;
      columns = result.length ? Object.keys(result[0]) : [];
      await db.close();
    }

    // === MSSQL ===
    else if (detectedDbType === "mssql") {
      // Для MSSQL нужен отдельный драйвер, пока возвращаем ошибку
      return res.status(400).json({ error: "MSSQL support coming soon. Use PostgreSQL or MySQL for now." });
    }

    // === Oracle ===
    else if (detectedDbType === "oracle") {
      return res.status(400).json({ error: "Oracle support coming soon. Use PostgreSQL or MySQL for now." });
    }

    return res.status(200).json({
      success: true,
      sql: sqlQuery,
      columns,
      rows,
    });
  } catch (error: any) {
    console.error("❌ SQL Error:", error.message);
    return res.status(500).json({ error: error.message || "Database connection error" });
  }
}
