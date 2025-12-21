-- Исправление неоднозначных ссылок на колонки в функциях
-- Проблема: column reference "downloads_limit" is ambiguous
-- Проблема: column reference "tokens_used" is ambiguous

-- ===== Исправление check_table_opens_limit =====
CREATE OR REPLACE FUNCTION check_table_opens_limit(user_uuid UUID)
RETURNS TABLE (
  within_limit BOOLEAN,
  opens_count INTEGER,
  opens_limit INTEGER,
  remaining INTEGER,
  downloads_count INTEGER,
  downloads_limit INTEGER,
  downloads_remaining INTEGER
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  user_plan TEXT;
  user_opens INTEGER;
  user_downloads INTEGER;
  plan_opens_limit INTEGER;
  plan_downloads_limit INTEGER;
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
  
  -- Получаем лимиты для плана (используем явные имена колонок)
  SELECT 
    plan_limits.table_opens_limit, 
    plan_limits.downloads_limit 
  INTO plan_opens_limit, plan_downloads_limit
  FROM get_plan_limits(user_plan) AS plan_limits;
  
  -- Получаем использованные открытия (используем явные имена таблиц)
  SELECT 
    COALESCE(uto.opens_count, 0), 
    COALESCE(uto.downloads_count, 0)
  INTO user_opens, user_downloads
  FROM user_table_opens uto
  WHERE uto.user_id = user_uuid;
  
  RETURN QUERY
  SELECT 
    (user_opens < plan_opens_limit) as within_limit,
    user_opens as opens_count,
    plan_opens_limit as opens_limit,
    GREATEST(0, plan_opens_limit - user_opens) as remaining,
    user_downloads as downloads_count,
    plan_downloads_limit as downloads_limit,
    GREATEST(0, plan_downloads_limit - user_downloads) as downloads_remaining;
END;
$$;

-- ===== Исправление get_available_tokens =====
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
         (SELECT token_limit FROM get_plan_limits(s.plan)) as plan_limit
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

-- ===== Исправление increment_table_opens =====
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
  SELECT plan_limits.period_days INTO plan_period_days
  FROM get_plan_limits(user_plan) AS plan_limits;
  
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

-- Проверка функций
DO $$
BEGIN
  RAISE NOTICE 'Функции обновлены для исправления неоднозначных ссылок на колонки.';
END $$;

