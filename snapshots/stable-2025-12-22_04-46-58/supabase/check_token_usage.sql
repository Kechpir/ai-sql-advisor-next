-- ===== ПРОВЕРКА РАБОТЫ СЧЕТЧИКА ТОКЕНОВ =====
-- Запустите эти запросы в SQL Editor Supabase для диагностики

-- 1. Проверка существования таблицы и структуры
SELECT 
  table_name,
  column_name,
  data_type,
  is_nullable
FROM information_schema.columns
WHERE table_schema = 'public' 
  AND table_name = 'user_token_usage'
ORDER BY ordinal_position;

-- 2. Проверка всех записей в таблице (замените YOUR_USER_ID на ваш user_id)
SELECT 
  id,
  user_id,
  tokens_used,
  period_start,
  period_end,
  created_at,
  updated_at
FROM user_token_usage
ORDER BY updated_at DESC
LIMIT 10;

-- 3. Проверка токенов для конкретного пользователя (замените YOUR_USER_ID)
-- Получить user_id можно из JWT токена или из таблицы auth.users
SELECT 
  u.id as user_id,
  u.email,
  COALESCE(t.tokens_used, 0) as tokens_used,
  t.period_start,
  t.period_end,
  t.updated_at
FROM auth.users u
LEFT JOIN user_token_usage t ON u.id = t.user_id
WHERE u.email = 'your-email@example.com'  -- Замените на ваш email
ORDER BY t.updated_at DESC;

-- 4. Проверка RPC функции add_user_tokens
-- Сначала получите ваш user_id из запроса выше, затем выполните:
-- SELECT add_user_tokens('YOUR_USER_ID'::UUID, 100);

-- 5. Проверка логов использования API
SELECT 
  id,
  user_id,
  function_name,
  tokens_used,
  created_at
FROM api_usage_logs
ORDER BY created_at DESC
LIMIT 20;

-- 6. Статистика по токенам для всех пользователей
SELECT 
  u.email,
  COALESCE(SUM(t.tokens_used), 0) as total_tokens,
  COUNT(t.id) as usage_count,
  MAX(t.updated_at) as last_updated
FROM auth.users u
LEFT JOIN user_token_usage t ON u.id = t.user_id
GROUP BY u.id, u.email
ORDER BY total_tokens DESC;

-- 7. Проверка триггера сброса токенов при обновлении подписки
SELECT 
  trigger_name,
  event_manipulation,
  event_object_table,
  action_statement
FROM information_schema.triggers
WHERE trigger_name = 'trigger_reset_tokens_on_subscription_update';

-- 8. Тест: Добавить тестовые токены (замените YOUR_USER_ID)
-- INSERT INTO user_token_usage (user_id, tokens_used)
-- VALUES ('YOUR_USER_ID'::UUID, 5000)
-- ON CONFLICT (user_id) 
-- DO UPDATE SET
--   tokens_used = user_token_usage.tokens_used + 5000,
--   updated_at = NOW()
-- RETURNING *;

