// /pages/api/fetch-schema.ts
import type { NextApiRequest, NextApiResponse } from "next";
import { Client } from "pg";
import mysql from "mysql2/promise";
import { checkAuth, checkConnectionOwnership } from '@/lib/auth';
import { detectDbType } from '@/lib/db/detectDbType';
import { normalizeConnectionString, getSupabaseConnectionVariants } from '@/lib/db/normalizeConnectionString';

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

    // Автоматически нормализуем connection string для разных провайдеров
    const normalized = normalizeConnectionString(connectionString);
    let workingConnectionString = normalized.connectionString;
    let connectionVariants: string[] = [workingConnectionString]; // Для использования в обработке ошибок
    
    // Автоматически определяем тип БД из строки подключения
    const dbInfo = detectDbType(workingConnectionString);
    const dbType = dbInfo?.type || "postgres";
    
    // Логируем только безопасную информацию (без пароля)
    const safeConnectionString = workingConnectionString.replace(/:[^:@]+@/, ':****@');
    console.log("Получен запрос на получение схемы:", { 
      dbType, 
      displayName: dbInfo?.displayName,
      provider: normalized.provider,
      method: normalized.method,
      connectionStringPreview: safeConnectionString.substring(0, 100),
      notes: normalized.notes
    });
    
    // Проверяем, что connection string валидный
    try {
      const testUrl = new URL(workingConnectionString);
      console.log("Connection string parsed:", { 
        protocol: testUrl.protocol,
        hostname: testUrl.hostname,
        port: testUrl.port,
        pathname: testUrl.pathname
      });
    } catch (parseError) {
      console.error("Ошибка парсинга connection string:", parseError);
      return res.status(400).json({ 
        success: false, 
        error: "Неверный формат connection string" 
      });
    }

    try {
    const schema: Record<string, string[]> = {};

    // === PostgreSQL ===
    if (dbType === "postgres" || dbType === "postgresql") {
      // Для Supabase БД используем Edge Function (работает изнутри инфраструктуры)
      // Прямое подключение может быть заблокировано firewall
      const isSupabaseDb = connectionString.includes('supabase.co');
      
      if (isSupabaseDb) {
        console.log('[fetch-schema] Пробуем Edge Function для Supabase БД (может требовать подписку)');
        try {
          const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
          const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
          
          if (supabaseUrl && anonKey) {
            const edgeFunctionUrl = `${supabaseUrl}/functions/v1/fetch_schema`;
            const edgeResponse = await fetch(edgeFunctionUrl, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'Authorization': jwt ? `Bearer ${jwt}` : `Bearer ${anonKey}`,
                'apikey': anonKey,
              },
              body: JSON.stringify({ 
                db_url: connectionString, 
                schema: 'public' 
              }),
            });
            
            if (edgeResponse.ok) {
              const edgeData = await edgeResponse.json();
              
              // Преобразуем формат из Edge Function в формат локального API
              if (edgeData.tables) {
                Object.keys(edgeData.tables).forEach((tableName) => {
                  const table = edgeData.tables[tableName];
                  schema[tableName] = table.columns ? table.columns.map((c: any) => c.name) : [];
                });
              }
              
              console.log('[fetch-schema] ✅ Edge Function успешно выполнен');
              return res.status(200).json({
                success: true,
                schema,
                tables: Object.keys(schema),
              });
            } else {
              const errorText = await edgeResponse.text();
              // Если ошибка подписки (403) или другая - пробуем прямое подключение
              console.log('[fetch-schema] Edge Function вернул ошибку, пробуем прямое подключение:', errorText.substring(0, 100));
            }
          }
        } catch (edgeError: any) {
          // Игнорируем ошибки Edge Function, пробуем прямое подключение
          console.log('[fetch-schema] Edge Function недоступен, используем прямое подключение:', edgeError.message?.substring(0, 100));
        }
      }
      
      // Прямое подключение для других PostgreSQL БД или fallback для Supabase
      // Для Supabase пробуем несколько вариантов connection string
      connectionVariants = [workingConnectionString];
      
      if (normalized.provider === 'supabase') {
        console.log('[fetch-schema] Supabase обнаружен, пробуем несколько вариантов подключения');
        console.log('[fetch-schema] Оригинальный connection string:', connectionString.replace(/:[^:@]+@/, ':****@'));
        const variants = getSupabaseConnectionVariants(connectionString);
        connectionVariants = variants;
        console.log(`[fetch-schema] Найдено ${variants.length} вариантов для попытки`);
        // Логируем первые 3 варианта для отладки (без пароля)
        variants.slice(0, 3).forEach((v, i) => {
          console.log(`[fetch-schema] Вариант ${i + 1}: ${v.replace(/:[^:@]+@/, ':****@').substring(0, 100)}...`);
        });
      }
      
      let lastError: Error | null = null;
      
      // Пробуем каждый вариант подключения
      for (let i = 0; i < connectionVariants.length; i++) {
        const variant = connectionVariants[i];
        const safeVariant = variant.replace(/:[^:@]+@/, ':****@');
        console.log(`[fetch-schema] Попытка ${i + 1}/${connectionVariants.length}: ${safeVariant.substring(0, 80)}...`);
        
        const client = new Client({ 
          connectionString: variant,
          // Увеличиваем таймаут для медленных подключений
          connectionTimeoutMillis: 8000,
          // Принудительно используем IPv4, если доступно
          keepAlive: true,
        });
        
        try {
          console.log('[fetch-schema] Подключаемся к БД...');
          await client.connect();
          console.log('[fetch-schema] ✅ Подключение установлено');
          
          // Если подключение успешно, обновляем workingConnectionString
          workingConnectionString = variant;

          // Выполняем запрос для получения схемы
          const query = `
            SELECT
              table_name,
              column_name,
              data_type
            FROM information_schema.columns
            WHERE table_schema = 'public'
            ORDER BY table_name, ordinal_position;
          `;

          console.log('[fetch-schema] Выполняем запрос для получения схемы...');
          const result = await client.query(query);
          console.log(`[fetch-schema] Получено строк: ${result.rows.length}`);
          
          result.rows.forEach((row) => {
            if (!schema[row.table_name]) schema[row.table_name] = [];
            schema[row.table_name].push(row.column_name);
          });
          
          console.log(`[fetch-schema] Обработано таблиц: ${Object.keys(schema).length}`);
          
          // Сохраняем успешный connection string для будущего использования
          if (normalized.provider === 'supabase' && variant !== connectionString) {
            console.log('[fetch-schema] ✅ Найден рабочий вариант connection string для Supabase');
            console.log('[fetch-schema] Автоматически исправлен формат подключения для оптимальной работы');
            
            // Сохраняем исправленный вариант в ответе, чтобы фронтенд мог его использовать
            // Фронтенд может обновить сохраненное подключение
          }
          
          await client.end();
          break; // Успешно подключились и получили схему, выходим из цикла
        } catch (connectError: any) {
          lastError = connectError;
          console.log(`[fetch-schema] Вариант ${i + 1} не сработал: ${connectError.message?.substring(0, 100)}`);
          
          try {
            await client.end();
          } catch (closeError) {
            // Игнорируем ошибки закрытия
          }
          
          // Если это последний вариант, пробрасываем ошибку
          if (i === connectionVariants.length - 1) {
            throw connectError;
          }
          
          // Продолжаем пробовать следующий вариант
          continue;
        }
      }
      
      // Если все варианты не сработали
      if (lastError && Object.keys(schema).length === 0) {
        throw lastError;
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
    
    // === Неподдерживаемый тип БД ===
    else {
      return res.status(400).json({ 
        success: false, 
        error: `Неподдерживаемый тип базы данных: ${dbInfo?.displayName || dbType}. Поддерживаются: PostgreSQL, MySQL, MariaDB, SQLite, CockroachDB` 
      });
    }

      res.status(200).json({
        success: true,
        schema,
        tables: Object.keys(schema),
        // Возвращаем исправленный connection string, если он был изменен
        ...(workingConnectionString !== connectionString && normalized.provider === 'supabase' ? {
          correctedConnectionString: workingConnectionString,
          provider: normalized.provider,
          method: normalized.method,
          message: 'Connection string автоматически исправлен для оптимальной работы с Supabase'
        } : {})
      });
    } catch (err: any) {
      console.error("Ошибка при получении схемы:", err);
      const errorMessage = err.message || err.toString() || "Ошибка при подключении к базе данных";
      
      // Специальная обработка ошибок с понятными сообщениями
      let userFriendlyMessage = errorMessage;
      
      if (normalized.provider === 'supabase') {
        if (err.code === 'ENOTFOUND' || errorMessage.includes('ENOTFOUND')) {
          userFriendlyMessage = `❌ Не удалось найти хост Supabase.\n\nРешение:\n1. Скопируйте connection string из Supabase Dashboard\n2. Выберите "Transaction pooler" (не Direct connection)\n3. Используйте хост вида: aws-0-[REGION].pooler.supabase.com\n4. Порт должен быть 6543\n5. Пользователь: postgres.[PROJECT-REF]`;
        } else if (err.code === 'ETIMEDOUT' || errorMessage.includes('timeout')) {
          userFriendlyMessage = `❌ Таймаут подключения к Supabase.\n\nПопробовано ${connectionVariants?.length || 1} вариантов подключения.\n\nРешение:\n1. Используйте Transaction pooler из Dashboard (порт 6543)\n2. Проверьте правильность пароля\n3. Убедитесь, что используете правильный регион\n4. Попробуйте Edge Function (требуется подписка)`;
        } else {
          userFriendlyMessage = `❌ Ошибка подключения к Supabase: ${errorMessage}\n\nПопробовано ${connectionVariants?.length || 1} вариантов.\n\nРекомендации:\n1. Используйте Transaction pooler connection string из Dashboard\n2. Формат: postgresql://postgres.[PROJECT-REF]:[PASSWORD]@aws-0-[REGION].pooler.supabase.com:6543/postgres?pgbouncer=true`;
        }
      } else if (err.code === 'ENOTFOUND' || errorMessage.includes('ENOTFOUND')) {
        userFriendlyMessage = `❌ Не удалось найти хост базы данных.\n\nПроверьте:\n1. Правильность хоста в connection string\n2. Доступность базы данных из сети\n3. Настройки DNS`;
      } else if (err.code === 'ETIMEDOUT' || errorMessage.includes('timeout')) {
        userFriendlyMessage = `❌ Таймаут подключения.\n\nПроверьте:\n1. Доступность базы данных\n2. Правильность порта\n3. Настройки firewall\n4. Правильность пароля`;
      }
      
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
          error: userFriendlyMessage,
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
