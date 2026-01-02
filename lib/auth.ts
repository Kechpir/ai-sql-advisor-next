/**
 * Утилиты для работы с авторизацией
 */

import type { NextApiRequest } from "next";
import { createClient, SupabaseClient } from '@supabase/supabase-js';

/**
 * Извлекает user_id из JWT токена
 */
export function getUserIdFromJWT(jwt: string | null): string | null {
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

/**
 * Извлекает JWT токен из заголовка Authorization
 */
export function getJWTFromRequest(req: NextApiRequest): string | null {
  const authHeader = req.headers.authorization;
  return authHeader?.replace(/^Bearer /i, '') || null;
}

/**
 * Проверяет авторизацию и возвращает user_id
 * Если не авторизован, возвращает null
 */
export function checkAuth(req: NextApiRequest): string | null {
  const jwt = getJWTFromRequest(req);
  return getUserIdFromJWT(jwt);
}

/**
 * Создает Supabase клиент с правильными ключами и JWT
 */
export function createSupabaseClient(jwt: string | null = null) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim().replace(/\s+/g, '');
  const serviceKey = (process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY)?.trim().replace(/\s+/g, '');
  
  if (!supabaseUrl || (!anonKey && !serviceKey)) {
    throw new Error('Supabase не настроен');
  }

  // Используем anon key с JWT для работы с RLS, если есть JWT
  // Иначе используем service key (если есть), иначе anon key
  const useAnonKey = jwt && anonKey;
  const supabaseKey = useAnonKey ? anonKey! : (serviceKey || anonKey!);
  
  return createClient(
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
}

/**
 * Проверяет, принадлежит ли connection string пользователю
 * Использует service key для обхода RLS (нужен доступ ко всем подключениям пользователя для проверки)
 */
export async function checkConnectionOwnership(userId: string, connectionString: string, jwt?: string | null): Promise<boolean> {
  try {
    const { decrypt, isEncrypted } = await import('@/lib/encryption');
    
    // Создаем Supabase клиент с anon key и JWT токеном
    // RLS ограничит доступ только к записям пользователя (использует auth.uid())
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
    const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim().replace(/\s+/g, '');
    
    if (!supabaseUrl || !anonKey) {
      console.error('[checkConnectionOwnership] Supabase не настроен (нет URL или anon key)');
      return false;
    }
    
    // Используем anon key с JWT токеном для работы RLS
    // RLS проверит auth.uid() и вернет только записи текущего пользователя
    const supabase = createClient(supabaseUrl, anonKey, {
      auth: { persistSession: false, autoRefreshToken: false },
      global: {
        ...(jwt ? { headers: { 'Authorization': `Bearer ${jwt}` } } : {})
      }
    });
    
    // Логируем только ID пользователя (безопасность - не логируем connection strings)
    if (process.env.NODE_ENV === 'development') {
      console.log('[checkConnectionOwnership] Проверка принадлежности для userId:', userId.substring(0, 8) + '...');
    }
    
    // Получаем все подключения пользователя
    const { data, error } = await supabase
      .from("user_connections")
      .select("connection_string_encrypted")
      .eq("user_id", userId);
    
    if (error) {
      console.error('[checkConnectionOwnership] Ошибка запроса к БД:', error);
      return false;
    }
    
    if (!data || data.length === 0) {
      console.log('[checkConnectionOwnership] У пользователя нет сохраненных подключений');
      return false;
    }
    
    console.log(`[checkConnectionOwnership] Найдено подключений: ${data.length}, проверяем принадлежность...`);
    
    // Проверяем каждое подключение (расшифровываем и сравниваем)
    let checkedCount = 0;
    for (const conn of data) {
      try {
        let decrypted = conn.connection_string_encrypted;
        
        // Если данные зашифрованы, расшифровываем их
        if (isEncrypted(conn.connection_string_encrypted)) {
          try {
            decrypted = decrypt(conn.connection_string_encrypted);
            checkedCount++;
          } catch (decryptError) {
            // Если не удалось расшифровать - пропускаем (возможно старый ключ или поврежденные данные)
            console.warn('[checkConnectionOwnership] Ошибка расшифровки подключения, пропускаем');
            continue;
          }
        } else {
          // Если данные не зашифрованы (старый формат) - используем как есть
          checkedCount++;
        }
        
        // Проверяем совпадение connection strings
        if (decrypted === connectionString) {
          console.log('[checkConnectionOwnership] ✅ Найдено совпадение - подключение принадлежит пользователю');
          return true;
        }
      } catch (error) {
        // Пропускаем ошибки обработки конкретного подключения
        console.warn('[checkConnectionOwnership] Ошибка обработки подключения:', error);
        continue;
      }
    }
    
    console.log(`[checkConnectionOwnership] ❌ Совпадений не найдено (проверено ${checkedCount} из ${data.length} подключений)`);
    return false;
  } catch (error) {
    console.error('[checkConnectionOwnership] Ошибка проверки принадлежности:', error);
    return false;
  }
}

