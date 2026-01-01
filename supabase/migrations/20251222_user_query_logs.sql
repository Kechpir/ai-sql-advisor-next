-- Миграция для создания таблицы логирования действий пользователей
-- user_query_logs - история всех действий пользователя в системе

-- ===== Таблица логирования действий =====
CREATE TABLE IF NOT EXISTS user_query_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  
  -- Тип действия
  action_type TEXT NOT NULL CHECK (action_type IN (
    'sql_generation',      -- Генерация SQL
    'sql_execution',       -- Выполнение SQL
    'table_open',          -- Открытие таблицы
    'data_export',         -- Экспорт данных
    'schema_load',         -- Загрузка схемы
    'schema_save',         -- Сохранение схемы
    'schema_delete',       -- Удаление схемы
    'connection_establish' -- Подключение к БД
  )),
  
  -- Данные действия
  sql_query TEXT,                    -- SQL запрос (если применимо)
  natural_language_query TEXT,       -- Исходный запрос на естественном языке
  schema_used JSONB,                 -- Использованная схема БД (JSON)
  dialect TEXT,                      -- Тип БД (postgres, mysql, sqlite, etc)
  
  -- Результаты (для SQL execution и table_open)
  rows_returned INTEGER,             -- Количество возвращенных строк
  execution_time_ms INTEGER,         -- Время выполнения в миллисекундах
  success BOOLEAN DEFAULT true,      -- Успешность операции
  error_message TEXT,                -- Сообщение об ошибке (если есть)
  
  -- Метаданные
  tokens_used INTEGER,               -- Использованные токены (если применимо)
  file_info JSONB,                   -- Информация о файле (если применимо)
  export_format TEXT,                -- Формат экспорта (CSV, Excel, JSON, etc)
  
  -- Временные метки
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Индексы для производительности
CREATE INDEX IF NOT EXISTS idx_user_query_logs_user_id ON user_query_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_user_query_logs_action_type ON user_query_logs(action_type);
CREATE INDEX IF NOT EXISTS idx_user_query_logs_created_at ON user_query_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_user_query_logs_user_created ON user_query_logs(user_id, created_at DESC);

-- Full-text search индекс для поиска по SQL запросам
CREATE INDEX IF NOT EXISTS idx_user_query_logs_sql_gin ON user_query_logs USING gin(to_tsvector('english', COALESCE(sql_query, '')));

-- RLS политики
ALTER TABLE user_query_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own logs"
  ON user_query_logs FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "System can insert logs"
  ON user_query_logs FOR INSERT
  WITH CHECK (true); -- Edge Functions используют service_role

-- Комментарии
COMMENT ON TABLE user_query_logs IS 'Логи всех действий пользователей в системе для диагностики и истории';
COMMENT ON COLUMN user_query_logs.action_type IS 'Тип действия: sql_generation, sql_execution, table_open, data_export, schema_load, schema_save, schema_delete, connection_establish';
COMMENT ON COLUMN user_query_logs.sql_query IS 'SQL запрос, если применимо (может быть NULL)';
COMMENT ON COLUMN user_query_logs.natural_language_query IS 'Исходный запрос на естественном языке для генерации SQL';
COMMENT ON COLUMN user_query_logs.schema_used IS 'JSON схема БД, которая использовалась';
COMMENT ON COLUMN user_query_logs.tokens_used IS 'Количество использованных токенов (для sql_generation)';

