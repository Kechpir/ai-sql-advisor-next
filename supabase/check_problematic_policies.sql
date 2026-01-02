-- ===== ПРОВЕРКА ПРОБЛЕМНЫХ ПОЛИТИК =====
-- Проверяем rate_limits и security_audit_log (у них по 1 политике)

-- 1. Детали политик для rate_limits
SELECT 
  policyname,
  cmd as command,
  roles,
  qual as using_expression,
  with_check as with_check_expression
FROM pg_policies
WHERE tablename = 'rate_limits'
ORDER BY cmd, policyname;

-- 2. Детали политик для security_audit_log
SELECT 
  policyname,
  cmd as command,
  roles,
  qual as using_expression,
  with_check as with_check_expression
FROM pg_policies
WHERE tablename = 'security_audit_log'
ORDER BY cmd, policyname;

-- 3. Проверка RLS статуса для этих таблиц
SELECT 
  tablename,
  rowsecurity as rls_enabled
FROM pg_tables
WHERE schemaname = 'public' 
  AND tablename IN ('rate_limits', 'security_audit_log');

