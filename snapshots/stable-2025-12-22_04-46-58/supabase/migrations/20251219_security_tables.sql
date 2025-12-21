-- Миграция для создания таблиц безопасности
-- subscriptions - управление подписками
-- user_connections - хранение подключений пользователей
-- api_usage_logs - логирование использования API

-- ===== Таблица подписок =====
CREATE TABLE IF NOT EXISTS subscriptions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  plan TEXT NOT NULL DEFAULT 'free', -- 'free', 'pro', 'team'
  status TEXT NOT NULL DEFAULT 'active', -- 'active', 'canceled', 'expired'
  stripe_subscription_id TEXT,
  stripe_customer_id TEXT,
  current_period_start TIMESTAMPTZ DEFAULT NOW(),
  current_period_end TIMESTAMPTZ DEFAULT (NOW() + INTERVAL '30 days'),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id)
);

-- Индексы для subscriptions
CREATE INDEX IF NOT EXISTS idx_subscriptions_user_id ON subscriptions(user_id);
CREATE INDEX IF NOT EXISTS idx_subscriptions_status ON subscriptions(status);
CREATE INDEX IF NOT EXISTS idx_subscriptions_period_end ON subscriptions(current_period_end);

-- RLS для subscriptions
ALTER TABLE subscriptions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own subscription"
  ON subscriptions FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can update their own subscription"
  ON subscriptions FOR UPDATE
  USING (auth.uid() = user_id);

-- ===== Таблица подключений пользователей =====
CREATE TABLE IF NOT EXISTS user_connections (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  connection_string_encrypted TEXT NOT NULL, -- Зашифрованная строка подключения
  db_type TEXT NOT NULL DEFAULT 'postgres', -- 'postgres', 'mysql', 'sqlite'
  host TEXT, -- Для отображения (без пароля)
  database TEXT, -- Для отображения
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, name)
);

-- Индексы для user_connections
CREATE INDEX IF NOT EXISTS idx_user_connections_user_id ON user_connections(user_id);
CREATE INDEX IF NOT EXISTS idx_user_connections_name ON user_connections(name);

-- RLS для user_connections
ALTER TABLE user_connections ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own connections"
  ON user_connections FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own connections"
  ON user_connections FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own connections"
  ON user_connections FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own connections"
  ON user_connections FOR DELETE
  USING (auth.uid() = user_id);

-- ===== Таблица логов использования API =====
CREATE TABLE IF NOT EXISTS api_usage_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  function_name TEXT NOT NULL, -- 'generate_sql', 'execute_sql', 'fetch_schema'
  tokens_used INTEGER DEFAULT 0, -- Для OpenAI
  sql_preview TEXT, -- Превью SQL (маскированное)
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Индексы для api_usage_logs
CREATE INDEX IF NOT EXISTS idx_api_usage_logs_user_id ON api_usage_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_api_usage_logs_created_at ON api_usage_logs(created_at);
CREATE INDEX IF NOT EXISTS idx_api_usage_logs_function_name ON api_usage_logs(function_name);

-- RLS для api_usage_logs
ALTER TABLE api_usage_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own usage logs"
  ON api_usage_logs FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "System can insert usage logs"
  ON api_usage_logs FOR INSERT
  WITH CHECK (true); -- Разрешаем вставку из Edge Functions

-- ===== Функция для автоматического обновления updated_at =====
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Триггеры для updated_at
CREATE TRIGGER update_subscriptions_updated_at
  BEFORE UPDATE ON subscriptions
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_user_connections_updated_at
  BEFORE UPDATE ON user_connections
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- ===== RPC функция для безопасного выполнения SQL =====
-- ⚠️ ВАЖНО: Эта функция должна быть защищена RLS и валидацией SQL
CREATE OR REPLACE FUNCTION execute_sql(sql_text TEXT)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER -- Требует осторожности!
AS $$
DECLARE
  result JSON;
BEGIN
  -- Дополнительная проверка SQL (на уровне БД)
  IF sql_text !~* '^\\s*SELECT' THEN
    RAISE EXCEPTION 'Only SELECT queries are allowed';
  END IF;

  IF sql_text ~* '(DROP|DELETE|UPDATE|INSERT|ALTER|TRUNCATE|CREATE|GRANT|REVOKE)' THEN
    RAISE EXCEPTION 'Dangerous operations are not allowed';
  END IF;

  -- Выполнение запроса
  EXECUTE format('SELECT json_agg(row_to_json(t)) FROM (%s) t', sql_text) INTO result;
  
  RETURN result;
EXCEPTION
  WHEN OTHERS THEN
    RAISE EXCEPTION 'SQL execution error: %', SQLERRM;
END;
$$;

-- Комментарии
COMMENT ON TABLE subscriptions IS 'Управление подписками пользователей';
COMMENT ON TABLE user_connections IS 'Хранение зашифрованных подключений к БД пользователей';
COMMENT ON TABLE api_usage_logs IS 'Логирование использования API для биллинга и мониторинга';
COMMENT ON FUNCTION execute_sql IS 'Безопасное выполнение SELECT запросов с валидацией';
