-- Обновление лимитов токенов для тарифов
-- Light: 1.3M токенов (для ~1,000 запросов)
-- Pro: 2.6M токенов (для ~2,000 запросов)

-- Обновляем функцию get_plan_limits с новыми лимитами
CREATE OR REPLACE FUNCTION get_plan_limits(plan_name TEXT)
RETURNS TABLE (
  token_limit INTEGER,
  table_opens_limit INTEGER,
  downloads_limit INTEGER,
  period_days INTEGER
) 
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    CASE plan_name
      WHEN 'free' THEN 100000
      WHEN 'light' THEN 1300000  -- Обновлено: 1.3M для ~1,000 запросов
      WHEN 'pro' THEN 2600000     -- Обновлено: 2.6M для ~2,000 запросов
      ELSE 100000
    END as token_limit,
    CASE plan_name
      WHEN 'free' THEN 20
      WHEN 'light' THEN 50
      WHEN 'pro' THEN 999999 -- Безлимит (очень большое число)
      ELSE 20
    END as table_opens_limit,
    CASE plan_name
      WHEN 'free' THEN 20
      WHEN 'light' THEN 50
      WHEN 'pro' THEN 999999 -- Безлимит
      ELSE 20
    END as downloads_limit,
    CASE plan_name
      WHEN 'free' THEN 3
      WHEN 'light' THEN 30
      WHEN 'pro' THEN 30
      ELSE 3
    END as period_days;
END;
$$;

COMMENT ON FUNCTION get_plan_limits IS 'Получение лимитов для плана подписки (обновлено: Light 1.3M, Pro 2.6M токенов)';

