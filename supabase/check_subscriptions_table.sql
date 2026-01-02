-- ===== ПРОВЕРКА СТРУКТУРЫ ТАБЛИЦЫ subscriptions =====
-- Выполните этот скрипт в SQL Editor Supabase для проверки

-- 1. Проверка существования таблицы и структуры
SELECT 
  table_name,
  column_name,
  data_type,
  is_nullable,
  column_default
FROM information_schema.columns
WHERE table_schema = 'public' 
  AND table_name = 'subscriptions'
ORDER BY ordinal_position;

-- 2. Проверка RLS статуса
SELECT 
  schemaname,
  tablename,
  rowsecurity as rls_enabled
FROM pg_tables
WHERE schemaname = 'public' 
  AND tablename = 'subscriptions';

-- 3. Проверка всех RLS политик на таблице subscriptions
SELECT 
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  cmd as command,
  qual as using_expression,
  with_check as with_check_expression
FROM pg_policies
WHERE schemaname = 'public' 
  AND tablename = 'subscriptions';

-- 4. Проверка данных в таблице (показывает все подписки)
SELECT 
  id,
  user_id,
  plan,
  status,
  current_period_start,
  current_period_end,
  current_period_end > NOW() as is_active_period,
  created_at,
  updated_at
FROM subscriptions
ORDER BY created_at DESC
LIMIT 10;

-- 5. Проверка, что политика позволяет читать подписки
SELECT 
  policyname,
  cmd,
  qual
FROM pg_policies
WHERE tablename = 'subscriptions' 
  AND cmd = 'SELECT';

-- 6. Если таблицы нет, создайте её выполнив миграцию:
-- supabase/migrations/20251219_security_tables.sql

-- 7. Если нужно создать тестовую подписку для пользователя:
-- INSERT INTO subscriptions (user_id, plan, status, current_period_start, current_period_end)
-- VALUES (
--   'YOUR_USER_ID_HERE', -- Замените на ваш user_id из auth.users
--   'free',
--   'active',
--   NOW(),
--   NOW() + INTERVAL '30 days'
-- )
-- ON CONFLICT (user_id) DO UPDATE SET
--   plan = EXCLUDED.plan,
--   status = EXCLUDED.status,
--   current_period_start = EXCLUDED.current_period_start,
--   current_period_end = EXCLUDED.current_period_end,
--   updated_at = NOW();

-- 8. Если нужно создать политику для service_role (если используется service key):
DROP POLICY IF EXISTS "Service role can read all subscriptions" ON subscriptions;

CREATE POLICY "Service role can read all subscriptions"
  ON subscriptions FOR SELECT
  TO service_role
  USING (true);

