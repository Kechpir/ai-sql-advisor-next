-- Исправление всех неоднозначностей в функциях
-- Применяйте эту миграцию ПОСЛЕ всех остальных

-- ===== 1. Исправление check_rate_limit =====
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
  CASE check_rate_limit.window_type
    WHEN 'minute' THEN window_start_time := date_trunc('minute', NOW());
    WHEN 'hour' THEN window_start_time := date_trunc('hour', NOW());
    WHEN 'day' THEN window_start_time := date_trunc('day', NOW());
    ELSE window_start_time := date_trunc('minute', NOW());
  END CASE;
  
  -- Получаем текущий счетчик (исправлена неоднозначность)
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
  VALUES (user_uuid, endpoint_name, 1, window_start_time, check_rate_limit.window_type)
  ON CONFLICT (user_id, endpoint, window_type, window_start)
  DO UPDATE SET
    request_count = rate_limits.request_count + 1;
  
  RETURN TRUE;
END;
$$;

-- ===== 2. Исправление get_available_tokens =====
CREATE OR REPLACE FUNCTION get_available_tokens(user_uuid UUID)
RETURNS TABLE (
  subscription_tokens INTEGER,
  purchased_tokens INTEGER,
  total_available INTEGER,
  tokens_used INTEGER,
  remaining INTEGER
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  user_subscription RECORD;
  plan_token_limit INTEGER;
  user_tokens_used INTEGER;
  active_purchased_tokens INTEGER;
BEGIN
  -- Получаем подписку пользователя
  SELECT s.*, 
         (SELECT pl.token_limit FROM get_plan_limits(s.plan) AS pl) as plan_limit
  INTO user_subscription
  FROM subscriptions s
  WHERE s.user_id = user_uuid
    AND s.status = 'active'
  LIMIT 1;

  -- Если подписки нет, возвращаем нули
  IF NOT FOUND THEN
    RETURN QUERY SELECT 0, 0, 0, 0, 0;
    RETURN;
  END IF;

  plan_token_limit := COALESCE(user_subscription.plan_limit, 0);

  -- Получаем использованные токены (используем явное имя таблицы)
  SELECT COALESCE(utu.tokens_used, 0) INTO user_tokens_used
  FROM user_token_usage utu
  WHERE utu.user_id = user_uuid;

  -- Получаем активные дополнительные токены
  SELECT COALESCE(SUM(pt.tokens_amount), 0) INTO active_purchased_tokens
  FROM purchased_tokens pt
  WHERE pt.user_id = user_uuid
    AND pt.is_active = true;

  -- Возвращаем результат
  RETURN QUERY SELECT
    plan_token_limit as subscription_tokens,
    active_purchased_tokens as purchased_tokens,
    (plan_token_limit + active_purchased_tokens) as total_available,
    user_tokens_used as tokens_used,
    GREATEST(0, (plan_token_limit + active_purchased_tokens) - user_tokens_used) as remaining;
END;
$$;

-- ===== 3. Исправление check_token_limit (убеждаемся, что все неоднозначности исправлены) =====
CREATE OR REPLACE FUNCTION check_token_limit(user_uuid UUID)
RETURNS TABLE (
  within_limit BOOLEAN,
  tokens_used INTEGER,
  token_limit INTEGER,
  purchased_tokens INTEGER,
  total_limit INTEGER,
  remaining INTEGER
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  user_subscription RECORD;
  plan_token_limit INTEGER;
  user_tokens_used INTEGER;
  active_purchased_tokens INTEGER;
  total_available INTEGER;
  calculated_remaining INTEGER;
BEGIN
  -- Получаем подписку пользователя (используем явные алиасы)
  SELECT s.*, 
         (SELECT pl.token_limit FROM get_plan_limits(s.plan) AS pl) as plan_limit
  INTO user_subscription
  FROM subscriptions s
  WHERE s.user_id = check_token_limit.user_uuid
    AND s.status = 'active'
  LIMIT 1;

  -- Если подписки нет, возвращаем ограничения free плана
  IF NOT FOUND THEN
    SELECT pl.token_limit INTO plan_token_limit FROM get_plan_limits('free') AS pl;
    SELECT COALESCE(utu.tokens_used, 0) INTO user_tokens_used
    FROM user_token_usage utu
    WHERE utu.user_id = check_token_limit.user_uuid;
    
    calculated_remaining := GREATEST(0, plan_token_limit - user_tokens_used);
    
    RETURN QUERY SELECT
      (calculated_remaining > 0) as within_limit,
      user_tokens_used as tokens_used,
      plan_token_limit as token_limit,
      0 as purchased_tokens,
      plan_token_limit as total_limit,
      calculated_remaining as remaining;
    RETURN;
  END IF;

  plan_token_limit := COALESCE(user_subscription.plan_limit, 0);

  -- Получаем использованные токены (используем явное имя таблицы)
  SELECT COALESCE(utu.tokens_used, 0) INTO user_tokens_used
  FROM user_token_usage utu
  WHERE utu.user_id = check_token_limit.user_uuid;

  -- Получаем активные дополнительные токены
  SELECT COALESCE(SUM(pt.tokens_amount), 0) INTO active_purchased_tokens
  FROM purchased_tokens pt
  WHERE pt.user_id = check_token_limit.user_uuid
    AND pt.is_active = true;

  total_available := plan_token_limit + active_purchased_tokens;
  calculated_remaining := GREATEST(0, total_available - user_tokens_used);

  -- within_limit должен быть false если remaining <= 0
  RETURN QUERY SELECT
    (calculated_remaining > 0) as within_limit,
    user_tokens_used as tokens_used,
    plan_token_limit as token_limit,
    active_purchased_tokens as purchased_tokens,
    total_available as total_limit,
    calculated_remaining as remaining;
END;
$$;

-- ===== 4. Исправление increment_table_opens (убеждаемся, что period_days исправлен) =====
CREATE OR REPLACE FUNCTION increment_table_opens(user_uuid UUID, is_download BOOLEAN DEFAULT FALSE)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET row_security = off
AS $$
DECLARE
  new_count INTEGER;
  user_plan TEXT;
  plan_period_days INTEGER;  -- Переименовано для избежания неоднозначности
  period_end_date TIMESTAMPTZ;
BEGIN
  -- Получаем план пользователя
  SELECT plan INTO user_plan
  FROM subscriptions
  WHERE user_id = user_uuid 
    AND status = 'active'
    AND current_period_end > NOW();
  
  -- Если нет активной подписки, считаем free
  IF user_plan IS NULL THEN
    user_plan := 'free';
  END IF;
  
  -- Получаем период для плана (используем явное имя колонки)
  SELECT pl.period_days INTO plan_period_days
  FROM get_plan_limits(user_plan) AS pl;
  
  -- Вычисляем конец периода
  IF user_plan = 'free' THEN
    -- Для free: период начинается с создания аккаунта или последнего сброса
    SELECT COALESCE(uto.period_start, NOW()) + (plan_period_days || ' days')::INTERVAL
    INTO period_end_date
    FROM user_table_opens uto
    WHERE uto.user_id = user_uuid;
    
    -- Если записи нет или период истек, начинаем новый период
    IF period_end_date IS NULL OR period_end_date < NOW() THEN
      period_end_date := NOW() + (plan_period_days || ' days')::INTERVAL;
    END IF;
  ELSE
    -- Для light/pro: период совпадает с подпиской
    SELECT s.current_period_end INTO period_end_date
    FROM subscriptions s
    WHERE s.user_id = user_uuid;
  END IF;
  
  -- Увеличиваем счетчик
  IF is_download THEN
    INSERT INTO user_table_opens (user_id, downloads_count, period_start, period_end)
    VALUES (user_uuid, 1, NOW(), period_end_date)
    ON CONFLICT (user_id) 
    DO UPDATE SET 
      downloads_count = user_table_opens.downloads_count + 1,
      period_start = CASE 
        WHEN user_table_opens.period_end < NOW() THEN NOW()
        ELSE user_table_opens.period_start
      END,
      period_end = period_end_date
    RETURNING downloads_count INTO new_count;
  ELSE
    INSERT INTO user_table_opens (user_id, opens_count, period_start, period_end)
    VALUES (user_uuid, 1, NOW(), period_end_date)
    ON CONFLICT (user_id) 
    DO UPDATE SET 
      opens_count = user_table_opens.opens_count + 1,
      period_start = CASE 
        WHEN user_table_opens.period_end < NOW() THEN NOW()
        ELSE user_table_opens.period_start
      END,
      period_end = period_end_date
    RETURNING opens_count INTO new_count;
  END IF;
  
  RETURN COALESCE(new_count, 0);
END;
$$;

COMMENT ON FUNCTION check_rate_limit IS 'Проверка rate limiting (исправлена неоднозначность window_type)';
COMMENT ON FUNCTION get_available_tokens IS 'Получение доступных токенов (исправлена неоднозначность tokens_used)';
COMMENT ON FUNCTION check_token_limit IS 'Проверка лимита токенов (исправлены все неоднозначности)';
COMMENT ON FUNCTION increment_table_opens IS 'Увеличение счетчика открытий (исправлена неоднозначность period_days)';

