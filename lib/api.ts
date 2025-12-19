const BASE = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1`;
const ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

function getToken(): string | null {
  if (typeof window === 'undefined') return null;
  try {
    const token = localStorage.getItem('jwt');
    // Проверяем, что токен не пустой и не строка "null"
    if (!token || token === 'null' || token === 'undefined' || token.trim() === '') {
      return null;
    }
    return token;
  } catch {
    return null;
  }
}

function isValidJWT(token: string | null): boolean {
  if (!token) return false;
  // Базовая проверка формата JWT (должен содержать 3 части, разделенные точками)
  const parts = token.split('.');
  return parts.length === 3;
}

const json = (body: any) => JSON.stringify(body);

function headers() {
  const jwt = getToken();
  return {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${jwt || ANON}`,
    'apikey': ANON,
  };
}

// ===== Schema fetching =====
export async function fetchSchema(dbUrl: string, schema = 'public') {
  const r = await fetch(`${BASE}/fetch_schema`, {
    method: 'POST',
    headers: headers(),
    body: json({ db_url: dbUrl, schema }),
  });
  if (!r.ok) throw new Error(await r.text());
  return r.json();
}

// ===== SQL generation =====
export async function generateSql(nl: string, schemaJson: any, dialect: string = 'postgres') {
  // Сначала пробуем локальный API endpoint
  let localApiError: string | null = null;
  
  try {
    const r = await fetch('/api/generate-sql', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: json({ nl, schema: schemaJson, dialect }),
    });
    
    if (r.ok) {
      const data = await r.json();
      return data;
    }
    
    // Если локальный API вернул ошибку, читаем её
    const errorText = await r.text();
    let errorMessage = errorText;
    try {
      const errorJson = JSON.parse(errorText);
      errorMessage = errorJson.error || errorText;
    } catch {
      // Если не JSON, используем текст как есть
    }
    
    localApiError = errorMessage;
    
    // Если это ошибка конфигурации (нет API ключа), не пробуем Supabase
    if (r.status === 500 && errorMessage.includes('OPENAI_API_KEY')) {
      throw new Error(`❌ ${errorMessage}\n\n💡 Решение: Добавьте OPENAI_API_KEY в файл .env.local и перезапустите сервер.`);
    }
    
    // Если локальный API не работает по другой причине, пробуем Supabase только если есть валидный JWT
    const jwt = getToken();
    if (!jwt || !isValidJWT(jwt)) {
      throw new Error(
        `❌ Локальный API недоступен: ${errorMessage}\n\n` +
        `💡 Решение:\n` +
        `1. Либо настройте OPENAI_API_KEY в .env.local для локального API\n` +
        `2. Либо войдите в систему через /auth для использования Supabase fallback`
      );
    }
    
    console.warn('⚠️ Локальный API не доступен, пробуем Supabase...', errorMessage);
  } catch (localError: any) {
    // Если это уже наша обработанная ошибка, пробрасываем её дальше
    if (localError.message && (
      localError.message.includes('❌') || 
      localError.message.includes('💡') ||
      (!localError.message.includes('fetch') && !localError.message.includes('Failed to fetch'))
    )) {
      throw localError;
    }
    
    // Если это сетевая ошибка, проверяем JWT перед fallback
    const jwt = getToken();
    if (!jwt || !isValidJWT(jwt)) {
      const errorMsg = localApiError || localError.message || 'Неизвестная ошибка';
      throw new Error(
        `❌ Локальный API недоступен: ${errorMsg}\n\n` +
        `💡 Решение:\n` +
        `1. Проверьте, что dev-сервер запущен (npm run dev)\n` +
        `2. Либо настройте OPENAI_API_KEY в .env.local\n` +
        `3. Либо войдите в систему через /auth для использования Supabase`
      );
    }
    
    console.warn('⚠️ Ошибка локального API, пробуем Supabase...', localError);
  }
  
  // Fallback на Supabase Edge Function (только если есть валидный JWT)
  const jwt = getToken();
  if (!jwt || !isValidJWT(jwt)) {
    throw new Error(
      `❌ Для использования Supabase требуется валидная авторизация.\n\n` +
      `💡 Решение: Перейдите на /auth и войдите в систему заново.`
    );
  }
  
  try {
    console.log('🔄 Пробуем Supabase Edge Function...');
    const r = await fetch(`${BASE}/generate_sql`, {
      method: 'POST',
      headers: headers(),
      body: json({ nl, schema: schemaJson, dialect }),
    });
    
    if (!r.ok) {
      const errorText = await r.text();
      let errorMessage = errorText;
      try {
        const errorJson = JSON.parse(errorText);
        errorMessage = errorJson.message || errorJson.error || errorText;
      } catch {
        // Если не JSON, используем текст как есть
      }
      
      console.error('❌ Supabase ошибка:', r.status, errorMessage);
      
      // Если ошибка связана с JWT (401 или сообщение содержит JWT/Invalid/token), очищаем токен
      if (r.status === 401 || 
          errorMessage.toLowerCase().includes('jwt') || 
          errorMessage.toLowerCase().includes('invalid') || 
          errorMessage.toLowerCase().includes('token') ||
          errorMessage.toLowerCase().includes('unauthorized') ||
          errorMessage.toLowerCase().includes('expired')) {
        // Очищаем невалидный токен
        try {
          localStorage.removeItem('jwt');
          console.warn('⚠️ Невалидный JWT токен удален из localStorage');
        } catch {}
        throw new Error(
          `❌ Токен авторизации невалиден или истек.\n\n` +
          `💡 Решение: Перейдите на /auth и войдите в систему заново.\n\n` +
          `📋 Детали ошибки: ${errorMessage}`
        );
      }
      
      throw new Error(`❌ Ошибка Supabase (${r.status}): ${errorMessage}`);
    }
    
    console.log('✅ Supabase успешно обработал запрос');
    return r.json();
  } catch (supabaseError: any) {
    // Если это уже наша обработанная ошибка, пробрасываем дальше
    if (supabaseError.message && (
      supabaseError.message.includes('❌') || 
      supabaseError.message.includes('💡') ||
      supabaseError.message.includes('Токен авторизации')
    )) {
      throw supabaseError;
    }
    
    // Если это ошибка сети или другая ошибка, проверяем, не связана ли она с JWT
    const errorMsgLower = (supabaseError.message || '').toLowerCase();
    if (errorMsgLower.includes('jwt') ||
        errorMsgLower.includes('invalid') ||
        errorMsgLower.includes('unauthorized') ||
        errorMsgLower.includes('expired')) {
      try {
        localStorage.removeItem('jwt');
        console.warn('⚠️ Невалидный JWT токен удален из localStorage');
      } catch {}
      throw new Error(
        `❌ Токен авторизации невалиден или истек.\n\n` +
        `💡 Решение: Перейдите на /auth и войдите в систему заново.\n\n` +
        `📋 Детали ошибки: ${supabaseError.message || 'Неизвестная ошибка'}`
      );
    }
    
    // Другие ошибки Supabase
    throw new Error(
      `❌ Ошибка Supabase: ${supabaseError.message || 'Неизвестная ошибка'}\n\n` +
      `💡 Проверьте:\n` +
      `1. Правильность NEXT_PUBLIC_SUPABASE_URL и NEXT_PUBLIC_SUPABASE_ANON_KEY\n` +
      `2. Доступность Supabase Edge Function /generate_sql\n` +
      `3. Валидность JWT токена (попробуйте перелогиниться)`
    );
  }
}

// ===== Schemas storage API =====
const SCHEMAS = `${BASE}/schemas`;

export async function listSchemas() {
  const r = await fetch(SCHEMAS, { method: 'GET', headers: headers() });
  if (!r.ok) throw new Error(await r.text());
  return r.json();
}

export async function saveSchema(name: string, schema: any) {
  const r = await fetch(SCHEMAS, {
    method: 'POST',
    headers: headers(),
    body: json({ op: 'save', name, schema }),
  });
  if (!r.ok) throw new Error(await r.text());
  return r.json();
}

export async function getSchema(name: string) {
  const r = await fetch(SCHEMAS, {
    method: 'POST',
    headers: headers(),
    body: json({ op: 'get', name }),
  });
  if (!r.ok) throw new Error(await r.text());
  return r.json();
}

export async function updateSchema(name: string, new_schema: any) {
  const r = await fetch(SCHEMAS, {
    method: 'POST',
    headers: headers(),
    body: json({ op: 'update', name, new_schema }),
  });
  if (!r.ok) throw new Error(await r.text());
  return r.json();
}

export async function diffSchema(name: string, new_schema: any) {
  const r = await fetch(SCHEMAS, {
    method: 'POST',
    headers: headers(),
    body: json({ op: 'diff', name, new_schema }),
  });
  if (!r.ok) throw new Error(await r.text());
  return r.json();
}

export async function deleteSchema(name: string) {
  const r = await fetch(SCHEMAS, {
    method: 'POST',
    headers: headers(),
    body: json({ op: 'delete', name }),
  });
  if (!r.ok) throw new Error(await r.text());
  return r.json();
}
