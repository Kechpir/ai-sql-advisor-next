import type { NextApiRequest, NextApiResponse } from "next";
import { createClient } from '@supabase/supabase-js';
import { encrypt, decrypt, isEncrypted } from '@/lib/encryption';
import { securityMiddleware } from '@/lib/middleware';
import { getJWTFromRequest } from '@/lib/auth';

// Определение типа БД из connection string
function detectDbType(connectionString: string): string {
  if (connectionString.startsWith("mysql://")) return "mysql";
  if (connectionString.startsWith("postgres://") || connectionString.startsWith("postgresql://")) return "postgres";
  if (connectionString.startsWith("sqlite://") || connectionString.startsWith("file:")) return "sqlite";
  return "postgres";
}

// Извлечение host и database из connection string для отображения
function parseConnectionString(connectionString: string): { host?: string; database?: string } {
  try {
    if (connectionString.startsWith("postgresql://") || connectionString.startsWith("postgres://")) {
      const url = new URL(connectionString);
      return {
        host: url.hostname,
        database: url.pathname.replace('/', '')
      };
    }
    if (connectionString.startsWith("mysql://")) {
      const url = new URL(connectionString);
      return {
        host: url.hostname,
        database: url.pathname.replace('/', '')
      };
    }
  } catch {
    // Игнорируем ошибки парсинга
  }
  return {};
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  // Используем security middleware для CORS и авторизации
  const { authorized, userId } = await securityMiddleware(req, res, {
    requireAuth: true,
    requireSubscription: 'free', // Минимальный план для сохранения подключений
    allowedMethods: ['GET', 'POST', 'DELETE', 'OPTIONS']
  });

  if (!authorized || !userId) {
    return; // Ответ уже отправлен middleware
  }

  const jwt = getJWTFromRequest(req);

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim().replace(/\s+/g, '');
  const serviceKey = (process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY)?.trim().replace(/\s+/g, '');
  
  if (!supabaseUrl || (!anonKey && !serviceKey)) {
    return res.status(500).json({ error: "Supabase не настроен" });
  }

  // Используем anon key с JWT для работы с RLS, если есть JWT
  // Иначе используем service key (если есть), иначе anon key
  const useAnonKey = jwt && anonKey;
  const supabaseKey = useAnonKey ? anonKey! : (serviceKey || anonKey!);
  
  const supabase = createClient(
    supabaseUrl,
    supabaseKey,
    {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
      global: {
        ...(jwt && useAnonKey ? { headers: { 'Authorization': `Bearer ${jwt}` } } : {})
      }
    }
  );

  try {
    if (req.method === "POST") {
      // Сохранение подключения
      const { name, connectionString } = req.body;

      if (!name || !connectionString) {
        return res.status(400).json({ error: "Не переданы name или connectionString" });
      }

      const dbType = detectDbType(connectionString);
      const { host, database } = parseConnectionString(connectionString);

      // Шифруем connection string перед сохранением
      const encryptedConnectionString = encrypt(connectionString);
      console.log('[save-connection] Сохранение подключения:', { userId, name: name.trim(), dbType, host, database });

      // Сохраняем подключение с зашифрованным connection string
      const { data, error } = await supabase
        .from("user_connections")
        .upsert({
          user_id: userId,
          name: name.trim(),
          connection_string_encrypted: encryptedConnectionString,
          db_type: dbType,
          host: host || null,
          database: database || null,
          updated_at: new Date().toISOString(),
        }, {
          onConflict: "user_id,name"
        })
        .select();

      if (error) {
        console.error('[save-connection] Ошибка сохранения:', error);
        return res.status(500).json({ error: error.message });
      }

      console.log('[save-connection] ✅ Подключение успешно сохранено:', data?.[0]?.id);
      return res.status(200).json({ success: true, connection: data?.[0] });
    }

    if (req.method === "GET") {
      // Загрузка всех подключений пользователя
      const { data, error } = await supabase
        .from("user_connections")
        .select("*")
        .eq("user_id", userId)
        .order("created_at", { ascending: false });

      if (error) {
        console.error('[save-connection] Ошибка загрузки:', error);
        return res.status(500).json({ error: error.message });
      }

      // Преобразуем в формат, который ожидают компоненты
      // Расшифровываем connection strings (они зашифрованы)
      const connections = (data || []).map(conn => {
        let decryptedConnectionString = conn.connection_string_encrypted;
        
        // Если данные зашифрованы, расшифровываем их
        if (isEncrypted(conn.connection_string_encrypted)) {
          try {
            decryptedConnectionString = decrypt(conn.connection_string_encrypted);
          } catch (error) {
            // Если не удалось расшифровать (старый ключ или поврежденные данные)
            // Пропускаем это подключение, чтобы не ломать загрузку других
            console.warn('[save-connection] Не удалось расшифровать подключение:', conn.name, error);
            return null;
          }
        }
        // Если данные не зашифрованы (старый формат) - используем как есть
        
        // НЕ исправляем Transaction pooler (порт 6543) - он правильный для serverless
        // Transaction pooler работает извне и идеален для Vercel
        // Исправляем только старые Direct connection строки, если они не работают
        // Но сначала пробуем как есть - возможно это уже правильный pooler connection string
        
        return {
          name: conn.name,
          connectionString: decryptedConnectionString,
          dbType: conn.db_type,
          host: conn.host,
          database: conn.database,
        };
      }).filter(conn => conn !== null);

      return res.status(200).json({ success: true, connections });
    }

    if (req.method === "DELETE") {
      // Удаление подключения
      const { name } = req.query;

      if (!name || typeof name !== 'string') {
        return res.status(400).json({ error: "Не передан name" });
      }

      const { error } = await supabase
        .from("user_connections")
        .delete()
        .eq("user_id", userId)
        .eq("name", name);

      if (error) {
        console.error('[save-connection] Ошибка удаления:', error);
        return res.status(500).json({ error: error.message });
      }

      return res.status(200).json({ success: true });
    }

    return res.status(405).json({ error: "Метод не поддерживается" });
  } catch (err: any) {
    console.error('[save-connection] Ошибка:', err);
    return res.status(500).json({ error: err?.message || "Внутренняя ошибка сервера" });
  }
}

