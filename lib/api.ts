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

// ===== SQL generation (Gemini test) =====
export async function generateSqlGemini(nl: string, schemaJson: any, dialect: string = 'postgres') {
  const jwt = getToken();
  
  try {
    const r = await fetch(`${BASE}/test_gemini`, {
      method: 'POST',
      headers: headers(),
      body: json({ nl, schema: schemaJson, dialect }),
    });
    
    if (!r.ok) {
      let errorText: string;
      try {
        errorText = await r.text();
      } catch (e) {
        errorText = `HTTP ${r.status} ${r.statusText}`;
      }
      
      let errorMessage = errorText;
      try {
        const errorJson = JSON.parse(errorText);
        errorMessage = errorJson.error || errorText;
      } catch {}
      
      throw new Error(`❌ Ошибка Gemini: ${errorMessage}`);
    }
    
    const data = await r.json();
    
    // Отправляем событие для обновления счетчика токенов
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new Event('sql-generated'));
    }
    
    return data;
  } catch (error: any) {
    console.error('[generateSqlGemini] Ошибка:', error);
    throw new Error(error.message || 'Ошибка генерации SQL через Gemini');
  }
}

// ===== SQL generation =====
export async function generateSql(nl: string, schemaJson: any, dialect: string = 'postgres') {
  // Получаем JWT токен один раз в начале функции
  const jwt = getToken();
  
  // Сначала пробуем локальный API endpoint
  let localApiError: string | null = null;
  
  try {
    const r = await fetch('/api/generate-sql', {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        ...(jwt && isValidJWT(jwt) ? { 'Authorization': `Bearer ${jwt}` } : {})
      },
      body: json({ nl, schema: schemaJson, dialect }),
    });
    
    if (r.ok) {
      const data = await r.json();
      // Отправляем событие для обновления счетчика токенов на фронте
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new Event('sql-generated'));
      }
      return data;
    }
    
    // Если локальный API вернул ошибку, читаем её
    let errorText: string;
    try {
      errorText = await r.text();
    } catch (e) {
      errorText = `HTTP ${r.status} ${r.statusText}`;
    }
    
    let errorMessage = errorText;
    let errorJson: any = null;
    try {
      errorJson = JSON.parse(errorText);
      errorMessage = errorJson.error || errorText;
    } catch {
      // Если не JSON, используем текст как есть
    }
    
    // КРИТИЧНО: Если это ошибка лимита токенов (403), НЕ делаем fallback на Supabase!
    if (r.status === 403 && errorJson?.limit_reached) {
      throw new Error(
        `❌ Достигнут лимит токенов\n\n` +
        `Использовано: ${errorJson.tokens_used || 0} из ${errorJson.token_limit || 0}\n` +
        `Осталось: ${errorJson.remaining || 0} токенов\n\n` +
        `💡 Для увеличения лимита перейдите на более высокий тариф.`
      );
    }
    
    // Нормализуем строку для безопасной обработки
    localApiError = String(errorMessage);
    
    // Если локальный API не работает (включая ошибку OPENAI_API_KEY), пробуем Supabase только если есть валидный JWT
    if (!jwt || !isValidJWT(jwt)) {
      const safeError = String(errorMessage || 'Неизвестная ошибка');
      // Если это ошибка про OPENAI_API_KEY, даём более понятное сообщение
      if (r.status === 500 && String(errorMessage).includes('OPENAI_API_KEY')) {
        throw new Error(
          `❌ ${String(errorMessage)}\n\n` +
          `💡 Решение:\n` +
          `1. Либо настройте OPENAI_API_KEY в .env.local для локального API\n` +
          `2. Либо войдите в систему через /auth для использования Supabase fallback`
        );
      }
      throw new Error(
        `❌ Локальный API недоступен: ${safeError}\n\n` +
        `💡 Решение:\n` +
        `1. Либо настройте OPENAI_API_KEY в .env.local для локального API\n` +
        `2. Либо войдите в систему через /auth для использования Supabase fallback`
      );
    }
    
    // Если есть валидный JWT, пробуем Supabase даже при ошибке OPENAI_API_KEY
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
    if (!jwt || !isValidJWT(jwt)) {
      const errorMsg = String(localApiError || localError?.message || 'Неизвестная ошибка');
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
      let errorText: string;
      try {
        errorText = await r.text();
      } catch (e) {
        errorText = `HTTP ${r.status} ${r.statusText}`;
      }
      
      let errorMessage = errorText;
      try {
        const errorJson = JSON.parse(errorText);
        errorMessage = errorJson.message || errorJson.error || errorText;
      } catch {
        // Если не JSON, используем текст как есть
      }
      
      // Нормализуем для безопасной обработки
      const safeErrorMessage = String(errorMessage);
      console.error('❌ Supabase ошибка:', r.status, safeErrorMessage);
      
      // Если ошибка связана с JWT (401 или сообщение содержит JWT/Invalid/token), очищаем токен
      const errorLower = safeErrorMessage.toLowerCase();
      if (r.status === 401 || 
          errorLower.includes('jwt') || 
          errorLower.includes('invalid') || 
          errorLower.includes('token') ||
          errorLower.includes('unauthorized') ||
          errorLower.includes('expired')) {
        // Очищаем невалидный токен
        try {
          localStorage.removeItem('jwt');
          console.warn('⚠️ Невалидный JWT токен удален из localStorage');
        } catch {}
        throw new Error(
          `❌ Токен авторизации невалиден или истек.\n\n` +
          `💡 Решение: Перейдите на /auth и войдите в систему заново.\n\n` +
          `📋 Детали ошибки: ${safeErrorMessage}`
        );
      }
      
      throw new Error(`❌ Ошибка Supabase (${r.status}): ${safeErrorMessage}`);
    }
    
    console.log('✅ Supabase успешно обработал запрос');
    const data = await r.json();
    
    console.log('[generateSql] Ответ от Supabase:', {
      hasSql: !!data.sql,
      hasUsage: !!data.usage,
      usage: data.usage,
      hasTokensUsed: !!data.tokens_used
    });
    
    // Обновляем токены, если они были использованы
    // Supabase Edge Function может вернуть usage или tokens_used
    const tokensUsed = data.usage?.total_tokens || data.tokens_used || 0;
    
    if (tokensUsed > 0 && jwt && isValidJWT(jwt)) {
      try {
        console.log(`[generateSql] Обновление токенов через API: ${tokensUsed} токенов`);
        const updateResponse = await fetch('/api/update-tokens', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${jwt}`,
          },
          body: JSON.stringify({
            tokens_used: tokensUsed,
          }),
        });
        
        if (updateResponse.ok) {
          const updateData = await updateResponse.json();
          console.log('✅ Токены обновлены после Supabase генерации:', updateData);
        } else {
          const errorData = await updateResponse.json().catch(() => ({ error: 'Unknown error' }));
          console.warn('⚠️ Ошибка обновления токенов после Supabase:', errorData);
        }
      } catch (tokenUpdateError: any) {
        console.warn('⚠️ Ошибка обновления токенов после Supabase:', tokenUpdateError?.message || tokenUpdateError);
        // Не блокируем ответ, если обновление токенов не удалось
      }
    } else {
      console.log('[generateSql] Пропуск обновления токенов:', {
        tokensUsed,
        hasJWT: !!jwt,
        isValidJWT: jwt ? isValidJWT(jwt) : false
      });
    }
    
    // Отправляем событие для обновления счетчика токенов на фронте
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new Event('sql-generated'));
    }
    return data;
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

// ===== Logging =====
export type LogActionType = 
  | 'sql_generation'
  | 'sql_execution'
  | 'table_open'
  | 'data_export'
  | 'schema_load'
  | 'schema_save'
  | 'schema_delete'
  | 'connection_establish';

export interface LogActionPayload {
  action_type: LogActionType;
  sql_query?: string;
  natural_language_query?: string;
  schema_used?: any;
  dialect?: string;
  rows_returned?: number;
  execution_time_ms?: number;
  success?: boolean;
  error_message?: string;
  tokens_used?: number;
  file_info?: any;
  export_format?: string;
}

/**
 * Логирование действия пользователя
 * @param payload Данные для логирования
 */
export async function logAction(payload: LogActionPayload): Promise<void> {
  const jwt = getToken();
  
  // Не логируем если нет JWT (пользователь не авторизован)
  if (!jwt || !isValidJWT(jwt)) {
    console.warn('[logAction] Пропуск логирования: пользователь не авторизован');
    return;
  }
  
  try {
    console.log('[logAction] Отправка лога:', { action_type: payload.action_type, hasJWT: !!jwt });
    
    const r = await fetch('/api/log-action', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${jwt}`
      },
      body: json(payload),
    });
    
    if (!r.ok) {
      const errorText = await r.text();
      console.error('[logAction] Ошибка логирования:', {
        status: r.status,
        statusText: r.statusText,
        error: errorText,
        action_type: payload.action_type,
      });
      // Не выбрасываем ошибку, чтобы не прерывать основной поток
      // Логирование - это дополнительная функция
    } else {
      const result = await r.json();
      console.log('[logAction] Лог успешно сохранен:', { id: result.id, action_type: payload.action_type });
    }
  } catch (error: any) {
    console.error('[logAction] Исключение при логировании:', {
      error: error.message,
      action_type: payload.action_type,
    });
    // Не выбрасываем ошибку, чтобы не прерывать основной поток
  }
}

// ===== Logs Retrieval =====
export interface GetLogsParams {
  action_type?: LogActionType;
  limit?: number;
  offset?: number;
  search?: string;
  start_date?: string;
  end_date?: string;
}

export interface LogEntry {
  id: string;
  user_id: string;
  action_type: LogActionType;
  sql_query?: string;
  natural_language_query?: string;
  schema_used?: any;
  dialect?: string;
  rows_returned?: number;
  execution_time_ms?: number;
  success: boolean;
  error_message?: string;
  tokens_used?: number;
  file_info?: any;
  export_format?: string;
  created_at: string;
}

export interface GetLogsResponse {
  logs: LogEntry[];
  total: number;
  limit: number;
  offset: number;
}

/**
 * Получение логов пользователя
 * @param params Параметры фильтрации
 */
export async function getLogs(params: GetLogsParams = {}): Promise<GetLogsResponse> {
  const jwt = getToken();
  
  const queryParams = new URLSearchParams();
  if (params.action_type) queryParams.append('action_type', params.action_type);
  if (params.limit) queryParams.append('limit', params.limit.toString());
  if (params.offset) queryParams.append('offset', params.offset.toString());
  if (params.search) queryParams.append('search', params.search);
  if (params.start_date) queryParams.append('start_date', params.start_date);
  if (params.end_date) queryParams.append('end_date', params.end_date);
  
  const r = await fetch(`/api/get-logs?${queryParams.toString()}`, {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
      ...(jwt && isValidJWT(jwt) ? { 'Authorization': `Bearer ${jwt}` } : {})
    },
  });
  
  if (!r.ok) {
    const errorText = await r.text();
    throw new Error(`Ошибка получения логов: ${errorText}`);
  }
  
  return r.json();
}

// ===== SQL Reviewer =====
export interface SqlReviewerParams {
  sql: string;
  schema?: any;
  dialect?: string;
  natural_language_query?: string;
}

export interface SqlReviewerResponse {
  review: string;
  reviewed_at: string;
}

/**
 * Получение AI-ревью SQL запроса (доступно только для тарифов Light и Pro)
 * Вызывает Supabase Edge Function напрямую
 * @param params Параметры для анализа SQL
 */
export async function reviewSql(params: SqlReviewerParams): Promise<SqlReviewerResponse> {
  const jwt = getToken();
  
  if (!jwt || !isValidJWT(jwt)) {
    throw new Error("Требуется авторизация для использования AI SQL Reviewer");
  }
  
  try {
    const r = await fetch(`${BASE}/sql_reviewer`, {
      method: 'POST',
      headers: headers(),
      body: json(params),
    });
    
    if (!r.ok) {
      const errorText = await r.text();
      let errorMessage = errorText;
      try {
        const errorJson = JSON.parse(errorText);
        errorMessage = errorJson.error || errorText;
      } catch {}
      throw new Error(`❌ Ошибка AI SQL Reviewer: ${errorMessage}`);
    }
    
    return r.json();
  } catch (error: any) {
    console.error('[reviewSql] Ошибка:', error);
    throw new Error(error.message || 'Ошибка получения AI-ревью');
  }
}
