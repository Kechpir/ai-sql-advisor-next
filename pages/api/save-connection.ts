import type { NextApiRequest, NextApiResponse } from "next";
import { createClient } from '@supabase/supabase-js';
import { encrypt, decrypt, isEncrypted } from '@/lib/encryption';

// CORS заголовки
function setCorsHeaders(res: NextApiResponse, origin: string | undefined) {
  const allowedOrigins = [
    'https://ai-sql-advisor.vercel.app',
    'http://localhost:3000',
    'http://localhost:3001'
  ];
  
  const originHeader = origin && allowedOrigins.includes(origin) ? origin : allowedOrigins[0];
  
  res.setHeader('Access-Control-Allow-Origin', originHeader);
  res.setHeader('Access-Control-Allow-Methods', 'POST, GET, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
}

// Извлечение user_id из JWT токена
function getUserIdFromJWT(jwt: string | null): string | null {
  if (!jwt) return null;
  try {
    const parts = jwt.split(".");
    if (parts.length !== 3) return null;
    const payloadBase64 = parts[1].replace(/-/g, '+').replace(/_/g, '/');
    const payload = JSON.parse(Buffer.from(payloadBase64, 'base64').toString('utf-8'));
    return payload?.sub ?? null;
  } catch {
    return null;
  }
}

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
  const origin = req.headers.origin;
  setCorsHeaders(res, origin);
  
  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  const authHeader = req.headers.authorization;
  const jwt = authHeader?.replace(/^Bearer /i, '') || null;
  const userId = getUserIdFromJWT(jwt);

  if (!userId) {
    return res.status(401).json({ error: "Не авторизован" });
  }

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

