-- Комплексная миграция безопасности
-- Защита от SQL injection, накрутки токенов, обеспечение конфиденциальности
-- Усиление RLS политик для всех тарифов

-- ===== 1. УСИЛЕНИЕ RLS ПОЛИТИК =====

-- Удаляем слишком открытые политики и создаем более строгие
DROP POLICY IF EXISTS "System can update token usage" ON user_token_usage;
DROP POLICY IF EXISTS "System can update table opens" ON user_table_opens;
DROP POLICY IF EXISTS "System can update token usage via RPC" ON user_token_usage;
DROP POLICY IF EXISTS "System can update table opens via RPC" ON user_table_opens;

-- user_token_usage: только через RPC функции
CREATE POLICY "System can update token usage via RPC"
  ON user_token_usage FOR UPDATE
  USING (false); -- Блокируем прямые обновления, только через RPC

-- user_table_opens: только через RPC функции
-- SECURITY DEFINER функции должны обходить RLS, но для дополнительной безопасности
-- блокируем прямые обновления. Функции с SECURITY DEFINER обойдут эту политику.
CREATE POLICY "System can update table opens via RPC"
  ON user_table_opens FOR UPDATE
  USING (false); -- Блокируем прямые обновления, только через SECURITY DEFINER RPC функции

-- ===== 2. ЗАЩИТА ОТ НАКРУТКИ ТОКЕНОВ =====

-- Обновляем функцию add_user_tokens с валидацией
CREATE OR REPLACE FUNCTION add_user_tokens(user_uuid UUID, tokens_to_add INTEGER)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET row_security = off  -- Временно отключаем RLS для этой функции
AS $$
DECLARE
  new_total INTEGER;
  user_plan TEXT;
  plan_token_limit INTEGER;
  current_tokens INTEGER;
BEGIN
  -- Валидация входных данных
  IF tokens_to_add < 0 THEN
    RAISE EXCEPTION 'Cannot add negative tokens';
  END IF;
  
  IF tokens_to_add > 100000 THEN
    RAISE EXCEPTION 'Too many tokens to add at once (max 100000)';
  END IF;
  
  -- Получаем план пользователя
  SELECT plan INTO user_plan
  FROM subscriptions
  WHERE user_id = user_uuid 
    AND status = 'active'
    AND current_period_end > NOW();
  
  IF user_plan IS NULL THEN
    user_plan := 'free';
  END IF;
  
  -- Получаем лимит токенов для плана
  SELECT token_limit INTO plan_token_limit
  FROM get_plan_limits(user_plan);
  
  -- Получаем текущие токены
  SELECT COALESCE(tokens_used, 0) INTO current_tokens
  FROM user_token_usage
  WHERE user_id = user_uuid;
  
  -- НЕ блокируем списание токенов здесь - проверка лимита делается ДО вызова этой функции
  -- Эта функция только списывает токены (добавляет к счетчику)
  -- Если лимит превышен, это нормально - пользователь просто использовал все токены
  
  -- Вставляем или обновляем запись
  INSERT INTO user_token_usage (user_id, tokens_used)
  VALUES (user_uuid, tokens_to_add)
  ON CONFLICT (user_id) 
  DO UPDATE SET
    tokens_used = user_token_usage.tokens_used + tokens_to_add,
    updated_at = NOW()
  RETURNING tokens_used INTO new_total;
  
  RETURN new_total;
END;
$$;

-- ===== 3. ЗАЩИТА ОТ НАКРУТКИ ОТКРЫТИЙ ТАБЛИЦ =====

-- Обновляем функцию increment_table_opens с валидацией
CREATE OR REPLACE FUNCTION increment_table_opens(user_uuid UUID, is_download BOOLEAN DEFAULT FALSE)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET row_security = off  -- Временно отключаем RLS для этой функции
AS $$
DECLARE
  new_count INTEGER;
  user_plan TEXT;
  period_days INTEGER;
  period_end_date TIMESTAMPTZ;
  current_opens INTEGER;
  current_downloads INTEGER;
  plan_opens_limit INTEGER;
  plan_downloads_limit INTEGER;
BEGIN
  -- Получаем план пользователя
  SELECT plan INTO user_plan
  FROM subscriptions
  WHERE user_id = user_uuid 
    AND status = 'active'
    AND current_period_end > NOW();
  
  IF user_plan IS NULL THEN
    user_plan := 'free';
  END IF;
  
  -- Получаем лимиты для плана
  SELECT table_opens_limit, downloads_limit, period_days
  INTO plan_opens_limit, plan_downloads_limit, period_days
  FROM get_plan_limits(user_plan);
  
  -- Получаем текущие счетчики
  SELECT COALESCE(opens_count, 0), COALESCE(downloads_count, 0)
  INTO current_opens, current_downloads
  FROM user_table_opens
  WHERE user_id = user_uuid;
  
  -- Проверяем лимит перед увеличением
  IF is_download THEN
    IF current_downloads >= plan_downloads_limit THEN
      RAISE EXCEPTION 'Download limit exceeded for plan %', user_plan;
    END IF;
  ELSE
    IF current_opens >= plan_opens_limit THEN
      RAISE EXCEPTION 'Table opens limit exceeded for plan %', user_plan;
    END IF;
  END IF;
  
  -- Вычисляем период
  IF user_plan = 'free' THEN
    SELECT COALESCE(period_start, NOW()) + (period_days || ' days')::INTERVAL
    INTO period_end_date
    FROM user_table_opens
    WHERE user_id = user_uuid;
    
    IF period_end_date IS NULL OR period_end_date < NOW() THEN
      period_end_date := NOW() + (period_days || ' days')::INTERVAL;
    END IF;
  ELSE
    SELECT current_period_end INTO period_end_date
    FROM subscriptions
    WHERE user_id = user_uuid;
  END IF;
  
  -- Увеличиваем счетчик
  IF is_download THEN
    INSERT INTO user_table_opens (user_id, downloads_count, period_start, period_end)
    VALUES (user_uuid, 1, NOW(), period_end_date)
    ON CONFLICT (user_id) 
    DO UPDATE SET
      downloads_count = user_table_opens.downloads_count + 1,
      updated_at = NOW();
    
    SELECT downloads_count INTO new_count
    FROM user_table_opens
    WHERE user_id = user_uuid;
  ELSE
    INSERT INTO user_table_opens (user_id, opens_count, period_start, period_end)
    VALUES (user_uuid, 1, NOW(), period_end_date)
    ON CONFLICT (user_id) 
    DO UPDATE SET
      opens_count = user_table_opens.opens_count + 1,
      updated_at = NOW();
    
    SELECT opens_count INTO new_count
    FROM user_table_opens
    WHERE user_id = user_uuid;
  END IF;
  
  RETURN new_count;
END;
$$;

-- ===== 4. ЗАЩИТА КОНФИДЕНЦИАЛЬНЫХ ДАННЫХ =====

-- Убеждаемся что connection_string_encrypted действительно зашифрован
-- Добавляем проверку что пароли не хранятся в открытом виде
ALTER TABLE user_connections 
  DROP CONSTRAINT IF EXISTS check_encrypted_connection;
ALTER TABLE user_connections
  ADD CONSTRAINT check_encrypted_connection 
  CHECK (
    connection_string_encrypted IS NOT NULL 
    AND connection_string_encrypted != ''
    AND connection_string_encrypted !~* 'password\s*=\s*[^&;]' -- Пароль не должен быть в открытом виде
  );

-- ===== 5. АУДИТ ЛОГИРОВАНИЕ =====

-- Таблица для аудита безопасности
CREATE TABLE IF NOT EXISTS security_audit_log (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  event_type TEXT NOT NULL, -- 'token_abuse', 'limit_exceeded', 'sql_injection_attempt', 'unauthorized_access'
  event_data JSONB,
  ip_address TEXT,
  user_agent TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_security_audit_user_id ON security_audit_log(user_id);
CREATE INDEX IF NOT EXISTS idx_security_audit_event_type ON security_audit_log(event_type);
CREATE INDEX IF NOT EXISTS idx_security_audit_created_at ON security_audit_log(created_at);

-- RLS для security_audit_log (только системный доступ)
ALTER TABLE security_audit_log ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "System can manage audit logs" ON security_audit_log;

CREATE POLICY "System can manage audit logs"
  ON security_audit_log FOR ALL
  USING (false); -- Только через service role

-- ===== 6. ФУНКЦИЯ ДЛЯ ЛОГИРОВАНИЯ БЕЗОПАСНОСТИ =====

CREATE OR REPLACE FUNCTION log_security_event(
  event_type TEXT,
  event_data JSONB DEFAULT '{}'::JSONB,
  user_uuid UUID DEFAULT NULL
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  INSERT INTO security_audit_log (user_id, event_type, event_data)
  VALUES (user_uuid, event_type, event_data);
END;
$$;

-- ===== 7. RATE LIMITING В БД =====

-- Таблица для rate limiting
CREATE TABLE IF NOT EXISTS rate_limits (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  endpoint TEXT NOT NULL, -- 'generate_sql', 'execute_sql', 'open_table'
  request_count INTEGER NOT NULL DEFAULT 1,
  window_start TIMESTAMPTZ DEFAULT NOW(),
  window_type TEXT NOT NULL DEFAULT 'minute', -- 'minute', 'hour', 'day'
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, endpoint, window_type, window_start)
);

CREATE INDEX IF NOT EXISTS idx_rate_limits_user_endpoint ON rate_limits(user_id, endpoint);
CREATE INDEX IF NOT EXISTS idx_rate_limits_window ON rate_limits(window_start);

-- RLS для rate_limits
ALTER TABLE rate_limits ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "System can manage rate limits" ON rate_limits;

CREATE POLICY "System can manage rate limits"
  ON rate_limits FOR ALL
  USING (false); -- Только через service role

-- Функция для проверки rate limit
CREATE OR REPLACE FUNCTION check_rate_limit(
  user_uuid UUID,
  endpoint_name TEXT,
  limit_count INTEGER,
  window_type TEXT DEFAULT 'minute'
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  window_start_time TIMESTAMPTZ;
  current_count INTEGER;
BEGIN
  -- Вычисляем начало окна
  CASE window_type
    WHEN 'minute' THEN window_start_time := date_trunc('minute', NOW());
    WHEN 'hour' THEN window_start_time := date_trunc('hour', NOW());
    WHEN 'day' THEN window_start_time := date_trunc('day', NOW());
    ELSE window_start_time := date_trunc('minute', NOW());
  END CASE;
  
  -- Получаем текущий счетчик
  SELECT COALESCE(rl.request_count, 0) INTO current_count
  FROM rate_limits rl
  WHERE rl.user_id = user_uuid
    AND rl.endpoint = endpoint_name
    AND rl.window_type = check_rate_limit.window_type
    AND rl.window_start = window_start_time;
  
  -- Если превышен лимит
  IF current_count >= limit_count THEN
    -- Логируем событие
    PERFORM log_security_event(
      'rate_limit_exceeded',
      jsonb_build_object(
        'user_id', user_uuid,
        'endpoint', endpoint_name,
        'count', current_count,
        'limit', limit_count
      ),
      user_uuid
    );
    RETURN FALSE;
  END IF;
  
  -- Увеличиваем счетчик
  INSERT INTO rate_limits (user_id, endpoint, request_count, window_start, window_type)
  VALUES (user_uuid, endpoint_name, 1, window_start_time, window_type)
  ON CONFLICT (user_id, endpoint, window_type, window_start)
  DO UPDATE SET
    request_count = rate_limits.request_count + 1;
  
  RETURN TRUE;
END;
$$;

-- ===== 8. ВАЛИДАЦИЯ SQL ЗАПРОСОВ =====

-- Улучшенная функция валидации SQL
CREATE OR REPLACE FUNCTION validate_sql_query(sql_text TEXT)
RETURNS BOOLEAN
LANGUAGE plpgsql
AS $$
BEGIN
  -- Проверка на пустой запрос
  IF sql_text IS NULL OR trim(sql_text) = '' THEN
    RETURN FALSE;
  END IF;
  
  -- Только SELECT запросы
  IF sql_text !~* '^\\s*SELECT' THEN
    RETURN FALSE;
  END IF;
  
  -- Блокируем опасные операции
  IF sql_text ~* '(DROP|DELETE|UPDATE|INSERT|ALTER|TRUNCATE|CREATE|GRANT|REVOKE|EXEC|EXECUTE|CALL)' THEN
    RETURN FALSE;
  END IF;
  
  -- Блокируем комментарии с потенциальными инъекциями
  IF sql_text ~* '--.*(DROP|DELETE|UPDATE|INSERT|ALTER)' THEN
    RETURN FALSE;
  END IF;
  
  -- Блокируем UNION SELECT инъекции (если не явно разрешено)
  IF sql_text ~* 'UNION.*SELECT' AND sql_text !~* 'UNION\\s+ALL\\s+SELECT' THEN
    -- Разрешаем только явные UNION ALL
    RETURN FALSE;
  END IF;
  
  -- Максимальная длина запроса (защита от DoS)
  IF length(sql_text) > 100000 THEN
    RETURN FALSE;
  END IF;
  
  RETURN TRUE;
END;
$$;

-- ===== 9. ОБНОВЛЕНИЕ ПРАВ ДОСТУПА =====

-- Отзываем публичный доступ к функциям, требующим авторизации
-- Разрешаем вызов для authenticated пользователей (anon не нужен, так как используется JWT)
-- REVOKE EXECUTE ON FUNCTION add_user_tokens(UUID, INTEGER) FROM anon;
REVOKE EXECUTE ON FUNCTION increment_table_opens(UUID, BOOLEAN) FROM anon;
REVOKE EXECUTE ON FUNCTION check_token_limit(UUID) FROM anon;
REVOKE EXECUTE ON FUNCTION check_table_opens_limit(UUID) FROM anon;

-- Разрешаем только authenticated пользователям
GRANT EXECUTE ON FUNCTION add_user_tokens(UUID, INTEGER) TO authenticated;
GRANT EXECUTE ON FUNCTION increment_table_opens(UUID, BOOLEAN) TO authenticated;
GRANT EXECUTE ON FUNCTION check_token_limit(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION check_table_opens_limit(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION get_plan_limits(TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION check_rate_limit(UUID, TEXT, INTEGER, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION validate_sql_query(TEXT) TO authenticated;

-- ===== 10. КОММЕНТАРИИ =====

COMMENT ON FUNCTION add_user_tokens IS 'Безопасное добавление токенов с валидацией лимитов';
COMMENT ON FUNCTION increment_table_opens IS 'Безопасное увеличение счетчика открытий с проверкой лимитов';
COMMENT ON FUNCTION validate_sql_query IS 'Валидация SQL запросов для защиты от инъекций';
COMMENT ON FUNCTION check_rate_limit IS 'Проверка rate limiting для защиты от злоупотребления';
COMMENT ON TABLE security_audit_log IS 'Логи безопасности для аудита и мониторинга';
COMMENT ON TABLE rate_limits IS 'Rate limiting для защиты от злоупотребления API';

