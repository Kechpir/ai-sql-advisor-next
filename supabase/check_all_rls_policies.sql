-- ===== ПРОВЕРКА RLS ПОЛИТИК ДЛЯ ВСЕХ ТАБЛИЦ =====
-- Выполните этот скрипт для проверки всех политик безопасности

-- 1. Список всех таблиц с RLS статусом
SELECT 
  schemaname,
  tablename,
  rowsecurity as rls_enabled,
  CASE 
    WHEN rowsecurity THEN '✅ Включен'
    ELSE '❌ Отключен'
  END as rls_status
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

-- 2. Все политики RLS для всех таблиц (детально)
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
ORDER BY tablename, cmd, policyname;

-- 3. Сводка по таблицам (сколько политик на каждую таблицу)
SELECT 
  tablename,
  COUNT(*) as total_policies,
  COUNT(*) FILTER (WHERE cmd = 'SELECT') as select_policies,
  COUNT(*) FILTER (WHERE cmd = 'INSERT') as insert_policies,
  COUNT(*) FILTER (WHERE cmd = 'UPDATE') as update_policies,
  COUNT(*) FILTER (WHERE cmd = 'DELETE') as delete_policies,
  COUNT(*) FILTER (WHERE cmd = 'ALL') as all_policies,
  COUNT(*) FILTER (WHERE 'service_role' = ANY(roles)) as service_role_policies,
  COUNT(*) FILTER (WHERE 'public' = ANY(roles) OR 'authenticated' = ANY(roles)) as user_policies
FROM pg_policies
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
GROUP BY tablename
ORDER BY tablename;

-- 4. Проверка таблиц без политик (проблема безопасности!)
SELECT 
  t.tablename,
  CASE 
    WHEN t.rowsecurity AND COUNT(p.policyname) = 0 THEN '⚠️ RLS включен, но нет политик!'
    WHEN t.rowsecurity THEN '✅ RLS включен'
    ELSE '❌ RLS отключен'
  END as security_status,
  COUNT(p.policyname) as policy_count
FROM pg_tables t
LEFT JOIN pg_policies p ON t.tablename = p.tablename AND t.schemaname = p.schemaname
WHERE t.schemaname = 'public' 
  AND t.tablename IN (
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
GROUP BY t.tablename, t.rowsecurity
ORDER BY t.tablename;

