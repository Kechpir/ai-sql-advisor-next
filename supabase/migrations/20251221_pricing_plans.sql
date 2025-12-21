-- Миграция для реализации системы тарифов
-- Обновление планов: free, light, pro
-- Добавление таблицы для отслеживания открытий таблиц

-- ===== Обновление таблицы subscriptions =====
-- Обновляем возможные значения плана
ALTER TABLE subscriptions 
  DROP CONSTRAINT IF EXISTS subscriptions_plan_check;

-- Обновляем существующие планы 'team' на 'pro' (если есть)
UPDATE subscriptions 
  SET plan = 'pro' 
  WHERE plan = 'team';

-- Добавляем проверку для новых планов
ALTER TABLE subscriptions 
  ADD CONSTRAINT subscriptions_plan_check 
  CHECK (plan IN ('free', 'light', 'pro'));

-- ===== Таблица для отслеживания открытий таблиц =====
CREATE TABLE IF NOT EXISTS user_table_opens (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  opens_count INTEGER NOT NULL DEFAULT 0, -- Количество открытий в текущем периоде
  downloads_count INTEGER NOT NULL DEFAULT 0, -- Количество скачиваний в текущем периоде
  period_start TIMESTAMPTZ DEFAULT NOW(), -- Начало текущего периода
  period_end TIMESTAMPTZ DEFAULT (NOW() + INTERVAL '3 days'), -- Конец текущего периода (для free - 3 дня, для light/pro - месяц)
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id)
);

-- Индексы для user_table_opens
CREATE INDEX IF NOT EXISTS idx_user_table_opens_user_id ON user_table_opens(user_id);
CREATE INDEX IF NOT EXISTS idx_user_table_opens_period_end ON user_table_opens(period_end);

-- RLS для user_table_opens
ALTER TABLE user_table_opens ENABLE ROW LEVEL SECURITY;

-- Удаляем существующие политики перед созданием (на случай повторного применения миграции)
DROP POLICY IF EXISTS "Users can view their own table opens" ON user_table_opens;
DROP POLICY IF EXISTS "Users can update their own table opens" ON user_table_opens;
DROP POLICY IF EXISTS "System can insert table opens" ON user_table_opens;
DROP POLICY IF EXISTS "System can update table opens" ON user_table_opens;

CREATE POLICY "Users can view their own table opens"
  ON user_table_opens FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can update their own table opens"
  ON user_table_opens FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "System can insert table opens"
  ON user_table_opens FOR INSERT
  WITH CHECK (true);

CREATE POLICY "System can update table opens"
  ON user_table_opens FOR UPDATE
  USING (true);

-- Триггер для автоматического обновления updated_at
DROP TRIGGER IF EXISTS update_user_table_opens_updated_at ON user_table_opens;
CREATE TRIGGER update_user_table_opens_updated_at
  BEFORE UPDATE ON user_table_opens
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- ===== Функция для получения лимитов по плану =====
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
      WHEN 'light' THEN 1300000
      WHEN 'pro' THEN 2600000
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

-- ===== Функция для проверки лимита токенов =====
CREATE OR REPLACE FUNCTION check_token_limit(user_uuid UUID)
RETURNS TABLE (
  within_limit BOOLEAN,
  tokens_used INTEGER,
  token_limit INTEGER,
  remaining INTEGER
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  user_plan TEXT;
  user_tokens INTEGER;
  plan_token_limit INTEGER;
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
  
  -- Получаем лимит токенов для плана
  SELECT token_limit INTO plan_token_limit
  FROM get_plan_limits(user_plan);
  
  -- Получаем использованные токены
  SELECT COALESCE(tokens_used, 0) INTO user_tokens
  FROM user_token_usage
  WHERE user_id = user_uuid;
  
  RETURN QUERY
  SELECT 
    (user_tokens < plan_token_limit) as within_limit,
    user_tokens as tokens_used,
    plan_token_limit as token_limit,
    GREATEST(0, plan_token_limit - user_tokens) as remaining;
END;
$$;

-- ===== Функция для проверки лимита открытий таблиц =====
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
  
  -- Получаем лимиты для плана
  SELECT table_opens_limit, downloads_limit 
  INTO plan_opens_limit, plan_downloads_limit
  FROM get_plan_limits(user_plan);
  
  -- Получаем использованные открытия
  SELECT COALESCE(opens_count, 0), COALESCE(downloads_count, 0)
  INTO user_opens, user_downloads
  FROM user_table_opens
  WHERE user_id = user_uuid;
  
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

-- ===== Функция для увеличения счетчика открытий =====
CREATE OR REPLACE FUNCTION increment_table_opens(user_uuid UUID, is_download BOOLEAN DEFAULT FALSE)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET row_security = off  -- Временно отключаем RLS для этой функции (SECURITY DEFINER + row_security = off)
AS $$
DECLARE
  new_count INTEGER;
  user_plan TEXT;
  period_days INTEGER;
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
  
  -- Получаем период для плана
  SELECT plan_limits.period_days INTO period_days
  FROM get_plan_limits(user_plan) AS plan_limits;
  
  -- Вычисляем конец периода
  IF user_plan = 'free' THEN
    -- Для free: период начинается с создания аккаунта или последнего сброса
    SELECT COALESCE(period_start, NOW()) + (period_days || ' days')::INTERVAL
    INTO period_end_date
    FROM user_table_opens
    WHERE user_id = user_uuid;
    
    -- Если записи нет или период истек, начинаем новый период
    IF period_end_date IS NULL OR period_end_date < NOW() THEN
      period_end_date := NOW() + (period_days || ' days')::INTERVAL;
    END IF;
  ELSE
    -- Для light/pro: период совпадает с подпиской
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
      period_start = COALESCE(EXCLUDED.period_start, user_table_opens.period_start),
      period_end = COALESCE(EXCLUDED.period_end, user_table_opens.period_end),
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
      period_start = COALESCE(EXCLUDED.period_start, user_table_opens.period_start),
      period_end = COALESCE(EXCLUDED.period_end, user_table_opens.period_end),
      updated_at = NOW();
    
    SELECT opens_count INTO new_count
    FROM user_table_opens
    WHERE user_id = user_uuid;
  END IF;
  
  RETURN new_count;
END;
$$;

-- ===== Функция для сброса счетчиков при обновлении подписки =====
CREATE OR REPLACE FUNCTION reset_table_opens_on_subscription_update()
RETURNS TRIGGER AS $$
DECLARE
  plan_period_days INTEGER;
  period_end_date TIMESTAMPTZ;
BEGIN
  -- Если подписка обновлена (новая оплата), сбрасываем счетчики
  IF NEW.current_period_start IS DISTINCT FROM OLD.current_period_start THEN
    -- Вычисляем период для нового плана
    SELECT plan_limits.period_days INTO plan_period_days
    FROM get_plan_limits(NEW.plan) AS plan_limits;
    
    period_end_date := NEW.current_period_end;
    
    -- Обновляем или создаем запись
    INSERT INTO user_table_opens (user_id, opens_count, downloads_count, period_start, period_end)
    VALUES (NEW.user_id, 0, 0, NEW.current_period_start, period_end_date)
    ON CONFLICT (user_id) 
    DO UPDATE SET
      opens_count = 0,
      downloads_count = 0,
      period_start = NEW.current_period_start,
      period_end = period_end_date,
      updated_at = NOW();
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Триггер для автоматического сброса счетчиков при обновлении подписки
DROP TRIGGER IF EXISTS trigger_reset_table_opens_on_subscription_update ON subscriptions;
CREATE TRIGGER trigger_reset_table_opens_on_subscription_update
  AFTER UPDATE ON subscriptions
  FOR EACH ROW
  WHEN (OLD.current_period_start IS DISTINCT FROM NEW.current_period_start)
  EXECUTE FUNCTION reset_table_opens_on_subscription_update();

-- Разрешаем вызов RPC функций
GRANT EXECUTE ON FUNCTION get_plan_limits(TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION get_plan_limits(TEXT) TO anon;
GRANT EXECUTE ON FUNCTION check_token_limit(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION check_token_limit(UUID) TO anon;
GRANT EXECUTE ON FUNCTION check_table_opens_limit(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION check_table_opens_limit(UUID) TO anon;
GRANT EXECUTE ON FUNCTION increment_table_opens(UUID, BOOLEAN) TO authenticated;
GRANT EXECUTE ON FUNCTION increment_table_opens(UUID, BOOLEAN) TO anon;

-- Комментарии
COMMENT ON TABLE user_table_opens IS 'Учет открытий таблиц и скачиваний файлов пользователями';
COMMENT ON FUNCTION get_plan_limits IS 'Получение лимитов для плана подписки';
COMMENT ON FUNCTION check_token_limit IS 'Проверка лимита токенов пользователя';
COMMENT ON FUNCTION check_table_opens_limit IS 'Проверка лимита открытий таблиц пользователя';
COMMENT ON FUNCTION increment_table_opens IS 'Увеличение счетчика открытий/скачиваний';

