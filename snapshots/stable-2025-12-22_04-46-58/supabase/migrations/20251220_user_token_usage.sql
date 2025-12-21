-- Миграция для создания таблицы учета токенов пользователей
-- user_token_usage - хранение текущего количества потраченных токенов

-- ===== Таблица учета токенов =====
CREATE TABLE IF NOT EXISTS user_token_usage (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  tokens_used INTEGER NOT NULL DEFAULT 0, -- Текущее количество потраченных токенов
  period_start TIMESTAMPTZ DEFAULT NOW(), -- Начало текущего периода (привязка к подписке)
  period_end TIMESTAMPTZ DEFAULT (NOW() + INTERVAL '30 days'), -- Конец текущего периода
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id)
);

-- Индексы для user_token_usage
CREATE INDEX IF NOT EXISTS idx_user_token_usage_user_id ON user_token_usage(user_id);
CREATE INDEX IF NOT EXISTS idx_user_token_usage_period_end ON user_token_usage(period_end);

-- RLS для user_token_usage
ALTER TABLE user_token_usage ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own token usage"
  ON user_token_usage FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can update their own token usage"
  ON user_token_usage FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "System can insert token usage"
  ON user_token_usage FOR INSERT
  WITH CHECK (true); -- Разрешаем вставку из Edge Functions

CREATE POLICY "System can update token usage"
  ON user_token_usage FOR UPDATE
  USING (true); -- Разрешаем обновление из Edge Functions

-- Триггер для автоматического обновления updated_at
CREATE TRIGGER update_user_token_usage_updated_at
  BEFORE UPDATE ON user_token_usage
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- ===== Функция для сброса токенов при обновлении подписки =====
CREATE OR REPLACE FUNCTION reset_tokens_on_subscription_update()
RETURNS TRIGGER AS $$
BEGIN
  -- Если подписка обновлена (новая оплата), сбрасываем токены
  -- Проверяем, что current_period_start изменился (новая оплата)
  IF NEW.current_period_start IS DISTINCT FROM OLD.current_period_start THEN
    -- Обновляем или создаем запись в user_token_usage
    INSERT INTO user_token_usage (user_id, tokens_used, period_start, period_end)
    VALUES (NEW.user_id, 0, NEW.current_period_start, NEW.current_period_end)
    ON CONFLICT (user_id) 
    DO UPDATE SET
      tokens_used = 0,
      period_start = NEW.current_period_start,
      period_end = NEW.current_period_end,
      updated_at = NOW();
    
    RAISE NOTICE 'Токены сброшены для пользователя % (новая оплата подписки)', NEW.user_id;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Триггер для автоматического сброса токенов при обновлении подписки
DROP TRIGGER IF EXISTS trigger_reset_tokens_on_subscription_update ON subscriptions;
CREATE TRIGGER trigger_reset_tokens_on_subscription_update
  AFTER UPDATE ON subscriptions
  FOR EACH ROW
  WHEN (OLD.current_period_start IS DISTINCT FROM NEW.current_period_start)
  EXECUTE FUNCTION reset_tokens_on_subscription_update();

-- ===== Функция для получения текущего количества токенов =====
CREATE OR REPLACE FUNCTION get_user_tokens(user_uuid UUID)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  token_count INTEGER;
BEGIN
  SELECT COALESCE(tokens_used, 0) INTO token_count
  FROM user_token_usage
  WHERE user_id = user_uuid;
  
  RETURN COALESCE(token_count, 0);
END;
$$;

-- ===== Функция для добавления токенов =====
CREATE OR REPLACE FUNCTION add_user_tokens(user_uuid UUID, tokens_to_add INTEGER)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  new_total INTEGER;
BEGIN
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

-- Разрешаем вызов RPC функций для authenticated пользователей
GRANT EXECUTE ON FUNCTION add_user_tokens(UUID, INTEGER) TO authenticated;
GRANT EXECUTE ON FUNCTION add_user_tokens(UUID, INTEGER) TO anon;
GRANT EXECUTE ON FUNCTION get_user_tokens(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION get_user_tokens(UUID) TO anon;

-- Комментарии
COMMENT ON TABLE user_token_usage IS 'Учет потраченных токенов пользователей (сбрасывается при оплате подписки)';
COMMENT ON FUNCTION reset_tokens_on_subscription_update IS 'Автоматический сброс токенов при обновлении подписки';
COMMENT ON FUNCTION get_user_tokens IS 'Получение текущего количества токенов пользователя';
COMMENT ON FUNCTION add_user_tokens IS 'Добавление токенов к счетчику пользователя';

