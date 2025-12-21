-- ===== ИСПРАВЛЕНИЕ ПРАВ ДОСТУПА ДЛЯ RPC ФУНКЦИЙ =====
-- Выполните этот скрипт в SQL Editor Supabase, если RPC функции не работают

-- Разрешаем вызов RPC функций для authenticated и anon пользователей
GRANT EXECUTE ON FUNCTION add_user_tokens(UUID, INTEGER) TO authenticated;
GRANT EXECUTE ON FUNCTION add_user_tokens(UUID, INTEGER) TO anon;
GRANT EXECUTE ON FUNCTION get_user_tokens(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION get_user_tokens(UUID) TO anon;

-- Проверка прав доступа
SELECT 
  routine_name,
  grantee,
  privilege_type
FROM information_schema.routine_privileges
WHERE routine_schema = 'public' 
  AND routine_name IN ('add_user_tokens', 'get_user_tokens')
ORDER BY routine_name, grantee;

