-- ===== ПРОВЕРКА ВСЕХ ТАБЛИЦ ПРОЕКТА =====
-- Выполните этот скрипт для проверки структуры всех таблиц

-- 1. Список всех таблиц в схеме public
SELECT 
  table_name,
  (SELECT COUNT(*) FROM information_schema.columns WHERE table_name = t.table_name) as column_count
FROM information_schema.tables t
WHERE table_schema = 'public' 
  AND table_type = 'BASE TABLE'
ORDER BY table_name;

-- 2. Проверка обязательных таблиц
SELECT 
  CASE 
    WHEN EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'subscriptions') THEN '✅'
    ELSE '❌'
  END as subscriptions,
  CASE 
    WHEN EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'user_connections') THEN '✅'
    ELSE '❌'
  END as user_connections,
  CASE 
    WHEN EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'api_usage_logs') THEN '✅'
    ELSE '❌'
  END as api_usage_logs,
  CASE 
    WHEN EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'user_table_opens') THEN '✅'
    ELSE '❌'
  END as user_table_opens,
  CASE 
    WHEN EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'user_token_usage') THEN '✅'
    ELSE '❌'
  END as user_token_usage,
  CASE 
    WHEN EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'rate_limits') THEN '✅'
    ELSE '❌'
  END as rate_limits,
  CASE 
    WHEN EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'security_audit_log') THEN '✅'
    ELSE '❌'
  END as security_audit_log,
  CASE 
    WHEN EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'purchased_tokens') THEN '✅'
    ELSE '❌'
  END as purchased_tokens,
  CASE 
    WHEN EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'user_query_logs') THEN '✅'
    ELSE '❌'
  END as user_query_logs;

-- 3. Проверка RLS статуса для всех таблиц
SELECT 
  schemaname,
  tablename,
  rowsecurity as rls_enabled
FROM pg_tables
WHERE schemaname = 'public' 
  AND tablename IN (
    'subscriptions',
    'user_connections',
    'api_usage_logs',
    'user_table_opens',
    'user_token_usage',
    'rate_limits',
    'security_audit_log',
    'purchased_tokens',
    'user_query_logs'
  )
ORDER BY tablename;

-- 4. Проверка политик RLS для subscriptions (важно!)
SELECT 
  policyname,
  cmd as command,
  roles,
  qual as using_expression
FROM pg_policies
WHERE tablename = 'subscriptions'
ORDER BY cmd, policyname;

