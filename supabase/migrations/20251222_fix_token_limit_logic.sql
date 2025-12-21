-- Исправление логики проверки лимита токенов
-- Проблема: within_limit может быть true даже при remaining = 0
-- Исправление: within_limit должен быть false если remaining <= 0

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
  -- Получаем подписку пользователя
  SELECT s.*, 
         (SELECT pl.token_limit FROM get_plan_limits(s.plan) AS pl) as plan_limit
  INTO user_subscription
  FROM subscriptions s
  WHERE s.user_id = user_uuid
    AND s.status = 'active'
  LIMIT 1;

  -- Если подписки нет, возвращаем ограничения free плана
  IF NOT FOUND THEN
    SELECT pl.token_limit INTO plan_token_limit FROM get_plan_limits('free') AS pl;
    SELECT COALESCE(utu.tokens_used, 0) INTO user_tokens_used
    FROM user_token_usage utu
    WHERE utu.user_id = user_uuid;
    
    calculated_remaining := GREATEST(0, plan_token_limit - user_tokens_used);
    
    RETURN QUERY SELECT
      (calculated_remaining > 0) as within_limit,  -- ИСПРАВЛЕНО: проверяем remaining, а не сравнение
      user_tokens_used as tokens_used,
      plan_token_limit as token_limit,
      0 as purchased_tokens,
      plan_token_limit as total_limit,
      calculated_remaining as remaining;
    RETURN;
  END IF;

  plan_token_limit := COALESCE(user_subscription.plan_limit, 0);

  -- Получаем использованные токены
  SELECT COALESCE(utu.tokens_used, 0) INTO user_tokens_used
  FROM user_token_usage utu
  WHERE utu.user_id = user_uuid;

  -- Получаем активные дополнительные токены
  SELECT COALESCE(SUM(pt.tokens_amount), 0) INTO active_purchased_tokens
  FROM purchased_tokens pt
  WHERE pt.user_id = user_uuid
    AND pt.is_active = true;

  total_available := plan_token_limit + active_purchased_tokens;
  calculated_remaining := GREATEST(0, total_available - user_tokens_used);

  -- ИСПРАВЛЕНО: within_limit должен быть false если remaining <= 0
  RETURN QUERY SELECT
    (calculated_remaining > 0) as within_limit,  -- КРИТИЧНО: проверяем remaining > 0, а не user_tokens_used < total_available
    user_tokens_used as tokens_used,
    plan_token_limit as token_limit,
    active_purchased_tokens as purchased_tokens,
    total_available as total_limit,
    calculated_remaining as remaining;
END;
$$;

COMMENT ON FUNCTION check_token_limit IS 'Проверка лимита токенов (исправлена логика: within_limit = false если remaining <= 0)';

