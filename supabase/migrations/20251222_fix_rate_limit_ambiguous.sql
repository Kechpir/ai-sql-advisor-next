-- Исправление неоднозначной ссылки на window_type в функции check_rate_limit

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

COMMENT ON FUNCTION check_rate_limit IS 'Проверка rate limiting для защиты от злоупотребления (исправлена неоднозначность window_type)';

