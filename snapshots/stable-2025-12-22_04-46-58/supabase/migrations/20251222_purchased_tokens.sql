-- Миграция для реализации покупки дополнительных токенов
-- Дополнительные токены переносятся на следующий месяц и активируются только после продления подписки

-- ===== Таблица для хранения дополнительно купленных токенов =====
CREATE TABLE IF NOT EXISTS purchased_tokens (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  tokens_amount INTEGER NOT NULL, -- Количество купленных токенов
  purchase_price DECIMAL(10, 2) NOT NULL, -- Цена покупки (для учета)
  purchase_date TIMESTAMPTZ DEFAULT NOW(), -- Дата покупки
  subscription_period_id TIMESTAMPTZ, -- Дата начала периода подписки, в котором были куплены (для отслеживания)
  is_active BOOLEAN DEFAULT false, -- Активны ли токены (только если подписка активна)
  expires_at TIMESTAMPTZ, -- Дата истечения (опционально, для будущего использования)
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Индексы для purchased_tokens
CREATE INDEX IF NOT EXISTS idx_purchased_tokens_user_id ON purchased_tokens(user_id);
CREATE INDEX IF NOT EXISTS idx_purchased_tokens_user_active ON purchased_tokens(user_id, is_active);
CREATE INDEX IF NOT EXISTS idx_purchased_tokens_subscription_period ON purchased_tokens(subscription_period_id);
-- Обновляем тип колонки, если она уже существует как UUID
DO $$ 
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'purchased_tokens' 
    AND column_name = 'subscription_period_id' 
    AND data_type = 'uuid'
  ) THEN
    ALTER TABLE purchased_tokens ALTER COLUMN subscription_period_id TYPE TIMESTAMPTZ USING NULL;
  END IF;
END $$;

-- RLS для purchased_tokens
ALTER TABLE purchased_tokens ENABLE ROW LEVEL SECURITY;

-- Удаляем политики, если они существуют, чтобы избежать ошибок при повторном применении
DROP POLICY IF EXISTS "Users can view their own purchased tokens" ON purchased_tokens;
DROP POLICY IF EXISTS "System can insert purchased tokens" ON purchased_tokens;
DROP POLICY IF EXISTS "System can update purchased tokens" ON purchased_tokens;

CREATE POLICY "Users can view their own purchased tokens"
  ON purchased_tokens FOR SELECT
  USING (auth.uid() = user_id);

-- Система может вставлять и обновлять (для API)
CREATE POLICY "System can insert purchased tokens"
  ON purchased_tokens FOR INSERT
  WITH CHECK (true);

CREATE POLICY "System can update purchased tokens"
  ON purchased_tokens FOR UPDATE
  USING (true);

-- Триггер для автоматического обновления updated_at
DROP TRIGGER IF EXISTS update_purchased_tokens_updated_at ON purchased_tokens;
CREATE TRIGGER update_purchased_tokens_updated_at
  BEFORE UPDATE ON purchased_tokens
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- ===== Функция для покупки дополнительных токенов =====
CREATE OR REPLACE FUNCTION purchase_additional_tokens(
  user_uuid UUID,
  package_type TEXT -- 'small' (1.5M за $2) или 'large' (2.5M за $3.5)
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  tokens_to_add INTEGER;
  purchase_price DECIMAL(10, 2);
  current_subscription RECORD;
  subscription_period_id TIMESTAMPTZ;
BEGIN
  -- Определяем количество токенов и цену в зависимости от пакета
  CASE package_type
    WHEN 'small' THEN
      tokens_to_add := 1500000; -- 1.5M токенов
      purchase_price := 2.00; -- $2
    WHEN 'large' THEN
      tokens_to_add := 2500000; -- 2.5M токенов
      purchase_price := 3.50; -- $3.5
    ELSE
      RAISE EXCEPTION 'Неверный тип пакета. Используйте "small" или "large"';
  END CASE;

  -- Проверяем, что у пользователя есть активная подписка (Light или Pro)
  SELECT * INTO current_subscription
  FROM subscriptions
  WHERE user_id = user_uuid
    AND status = 'active'
    AND plan IN ('light', 'pro')
  LIMIT 1;

  IF NOT FOUND THEN
    RETURN json_build_object(
      'success', false,
      'error', 'Требуется активная подписка Light или Pro для покупки дополнительных токенов'
    );
  END IF;

  -- Используем current_period_start как идентификатор периода (TIMESTAMPTZ)
  subscription_period_id := current_subscription.current_period_start;

  -- Добавляем запись о покупке (токены неактивны до продления подписки)
  INSERT INTO purchased_tokens (
    user_id,
    tokens_amount,
    purchase_price,
    subscription_period_id,
    is_active,
    purchase_date
  )
  VALUES (
    user_uuid,
    tokens_to_add,
    purchase_price,
    subscription_period_id,
    true, -- Активны сразу, так как подписка активна
    NOW()
  );

  RETURN json_build_object(
    'success', true,
    'tokens_added', tokens_to_add,
    'price', purchase_price,
    'message', format('Успешно куплено %s токенов за $%s', tokens_to_add::TEXT, purchase_price::TEXT)
  );
END;
$$;

-- ===== Функция для получения доступных токенов (подписочные + дополнительные) =====
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

  -- Получаем использованные токены
  SELECT COALESCE(tokens_used, 0) INTO user_tokens_used
  FROM user_token_usage
  WHERE user_id = user_uuid;

  -- Получаем активные дополнительные токены
  SELECT COALESCE(SUM(tokens_amount), 0) INTO active_purchased_tokens
  FROM purchased_tokens
  WHERE user_id = user_uuid
    AND is_active = true;

  -- Возвращаем результат
  RETURN QUERY SELECT
    plan_token_limit as subscription_tokens,
    active_purchased_tokens as purchased_tokens,
    (plan_token_limit + active_purchased_tokens) as total_available,
    user_tokens_used as tokens_used,
    GREATEST(0, (plan_token_limit + active_purchased_tokens) - user_tokens_used) as remaining;
END;
$$;

-- ===== Обновленная функция проверки лимита токенов (с учетом дополнительных) =====
-- Удаляем старую версию функции, так как изменился тип возврата
DROP FUNCTION IF EXISTS check_token_limit(UUID);

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
    SELECT COALESCE(tokens_used, 0) INTO user_tokens_used
    FROM user_token_usage
    WHERE user_id = user_uuid;
    
    RETURN QUERY SELECT
      (user_tokens_used < plan_token_limit) as within_limit,
      user_tokens_used as tokens_used,
      plan_token_limit as token_limit,
      0 as purchased_tokens,
      plan_token_limit as total_limit,
      GREATEST(0, plan_token_limit - user_tokens_used) as remaining;
    RETURN;
  END IF;

  plan_token_limit := COALESCE(user_subscription.plan_limit, 0);

  -- Получаем использованные токены
  SELECT COALESCE(tokens_used, 0) INTO user_tokens_used
  FROM user_token_usage
  WHERE user_id = user_uuid;

  -- Получаем активные дополнительные токены
  SELECT COALESCE(SUM(tokens_amount), 0) INTO active_purchased_tokens
  FROM purchased_tokens
  WHERE user_id = user_uuid
    AND is_active = true;

  total_available := plan_token_limit + active_purchased_tokens;

  RETURN QUERY SELECT
    (user_tokens_used < total_available) as within_limit,
    user_tokens_used as tokens_used,
    plan_token_limit as token_limit,
    active_purchased_tokens as purchased_tokens,
    total_available as total_limit,
    GREATEST(0, total_available - user_tokens_used) as remaining;
END;
$$;

-- ===== Функция для обработки продления подписки (активация дополнительных токенов) =====
CREATE OR REPLACE FUNCTION activate_purchased_tokens_on_renewal(user_uuid UUID)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  activated_count INTEGER := 0;
  previous_period_start TIMESTAMPTZ;
  current_subscription RECORD;
BEGIN
  -- Получаем текущую подписку
  SELECT * INTO current_subscription
  FROM subscriptions
  WHERE user_id = user_uuid
    AND status = 'active'
  LIMIT 1;

  IF NOT FOUND THEN
    RETURN 0;
  END IF;

  -- Активируем все неактивные дополнительные токены, купленные в предыдущих периодах
  -- (включая истекший период - они переносятся на следующий месяц)
  -- Токены из текущего периода уже активны
  UPDATE purchased_tokens
  SET is_active = true,
      updated_at = NOW()
  WHERE user_id = user_uuid
    AND is_active = false
    AND subscription_period_id IS NOT NULL
    AND subscription_period_id <= current_subscription.current_period_start;

  GET DIAGNOSTICS activated_count = ROW_COUNT;

  RETURN activated_count;
END;
$$;

-- ===== Обновленная функция сброса токенов при обновлении подписки =====
-- Теперь сжигает только подписочные токены, дополнительные переносятся
CREATE OR REPLACE FUNCTION reset_tokens_on_subscription_update()
RETURNS TRIGGER AS $$
DECLARE
  activated_purchased INTEGER;
BEGIN
  -- Если подписка обновлена (новая оплата), сбрасываем только подписочные токены
  -- Проверяем, что current_period_start изменился (новая оплата)
  IF NEW.current_period_start IS DISTINCT FROM OLD.current_period_start THEN
    -- Обновляем или создаем запись в user_token_usage (сбрасываем только подписочные токены)
    INSERT INTO user_token_usage (user_id, tokens_used, period_start, period_end)
    VALUES (NEW.user_id, 0, NEW.current_period_start, NEW.current_period_end)
    ON CONFLICT (user_id) 
    DO UPDATE SET
      tokens_used = 0, -- Сбрасываем счетчик использованных токенов
      period_start = NEW.current_period_start,
      period_end = NEW.current_period_end,
      updated_at = NOW();
    
    -- Активируем дополнительные токены из предыдущих периодов (включая истекший период)
    -- Дополнительные токены переносятся на следующий месяц
    SELECT activate_purchased_tokens_on_renewal(NEW.user_id) INTO activated_purchased;
    
    -- Дополнительные токены из истекшего периода остаются активными (переносятся)
    -- Подписочные токены "сгорают" (счетчик tokens_used сбрасывается, новый лимит берется из плана)
    
    RAISE NOTICE 'Токены сброшены для пользователя % (новая оплата подписки). Активировано дополнительных токенов: %', NEW.user_id, activated_purchased;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ===== Функция для деактивации дополнительных токенов при истечении подписки =====
CREATE OR REPLACE FUNCTION deactivate_tokens_on_subscription_expiry()
RETURNS TRIGGER AS $$
BEGIN
  -- Если подписка истекла (status изменился на 'canceled' или 'past_due')
  IF NEW.status IN ('canceled', 'past_due', 'unpaid') AND OLD.status = 'active' THEN
    -- Деактивируем все дополнительные токены
    UPDATE purchased_tokens
    SET is_active = false,
        updated_at = NOW()
    WHERE user_id = NEW.user_id
      AND is_active = true;
    
    RAISE NOTICE 'Дополнительные токены деактивированы для пользователя % (подписка истекла)', NEW.user_id;
  END IF;
  
  -- Если подписка снова активирована, активируем дополнительные токены
  IF NEW.status = 'active' AND OLD.status != 'active' THEN
    PERFORM activate_purchased_tokens_on_renewal(NEW.user_id);
    
    RAISE NOTICE 'Дополнительные токены активированы для пользователя % (подписка возобновлена)', NEW.user_id;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Триггер для деактивации токенов при истечении подписки
DROP TRIGGER IF EXISTS trigger_deactivate_tokens_on_subscription_expiry ON subscriptions;
CREATE TRIGGER trigger_deactivate_tokens_on_subscription_expiry
  AFTER UPDATE ON subscriptions
  FOR EACH ROW
  WHEN (OLD.status IS DISTINCT FROM NEW.status)
  EXECUTE FUNCTION deactivate_tokens_on_subscription_expiry();

-- Разрешаем вызов RPC функций
GRANT EXECUTE ON FUNCTION purchase_additional_tokens(UUID, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION get_available_tokens(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION check_token_limit(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION activate_purchased_tokens_on_renewal(UUID) TO authenticated;

-- Комментарии
COMMENT ON TABLE purchased_tokens IS 'Дополнительно купленные токены (переносятся на следующий месяц, активируются только при активной подписке)';
COMMENT ON FUNCTION purchase_additional_tokens IS 'Покупка дополнительных токенов: small (1.5M за $2) или large (2.5M за $3.5)';
COMMENT ON FUNCTION get_available_tokens IS 'Получение доступных токенов: подписочные + дополнительные';
COMMENT ON FUNCTION check_token_limit IS 'Проверка лимита токенов с учетом дополнительных';
COMMENT ON FUNCTION activate_purchased_tokens_on_renewal IS 'Активация дополнительных токенов при продлении подписки';

