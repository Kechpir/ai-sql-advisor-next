-- ===== ДИАГНОСТИКА ПРОБЛЕМЫ С ПОДПИСКОЙ =====
-- Запустите эти запросы в SQL Editor Supabase для диагностики

-- 1. Проверка существования таблицы и структуры
SELECT 
  table_name,
  column_name,
  data_type
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

-- 4. Проверка данных в таблице (замените YOUR_USER_ID на ваш user_id)
SELECT 
  id,
  user_id,
  plan,
  status,
  current_period_start,
  current_period_end,
  current_period_end > NOW() as is_active_period
FROM subscriptions
WHERE user_id = '080a9e98-3ecf-4ae6-b6a3-999ddf198fdc'; -- Замените на ваш user_id

-- 5. Проверка, что политика позволяет читать подписки
-- Эта политика должна существовать:
SELECT 
  policyname,
  cmd,
  qual
FROM pg_policies
WHERE tablename = 'subscriptions' 
  AND cmd = 'SELECT';

-- 6. Тест: попробуйте прочитать подписку от имени пользователя
-- (замените YOUR_USER_ID на ваш user_id)
SET LOCAL role TO 'authenticated';
SET LOCAL request.jwt.claim.sub TO '080a9e98-3ecf-4ae6-b6a3-999ddf198fdc';
SELECT * FROM subscriptions WHERE user_id = '080a9e98-3ecf-4ae6-b6a3-999ddf198fdc';

-- 7. Если нужно временно отключить RLS для тестирования (НЕ ДЛЯ PRODUCTION!)
-- ALTER TABLE subscriptions DISABLE ROW LEVEL SECURITY;

-- 8. Если нужно создать политику для SERVICE_ROLE (альтернативное решение)
-- CREATE POLICY "Service role can read all subscriptions"
--   ON subscriptions FOR SELECT
--   TO service_role
--   USING (true);

-- 9. РЕШЕНИЕ: Создать политику для service_role (выполните это, если SERVICE_ROLE не работает)
-- Это позволит Edge Functions читать подписки через SERVICE_ROLE ключ
-- Сначала удаляем старую политику, если она существует
DROP POLICY IF EXISTS "Service role can read all subscriptions" ON subscriptions;

-- Затем создаем новую
CREATE POLICY "Service role can read all subscriptions"
  ON subscriptions FOR SELECT
  TO service_role
  USING (true);

-- 10. Альтернативное решение: временно отключить RLS для тестирования (НЕ ДЛЯ PRODUCTION!)
-- ALTER TABLE subscriptions DISABLE ROW LEVEL SECURITY;
