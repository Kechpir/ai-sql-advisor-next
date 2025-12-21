-- Исправление прав доступа к RPC функциям
-- Выполните этот скрипт, если получаете ошибки 500 при вызове функций

-- Проверяем и исправляем права для check_table_opens_limit
DO $$ 
BEGIN
  -- Отзываем права у anon (если есть)
  REVOKE EXECUTE ON FUNCTION check_table_opens_limit(UUID) FROM anon;
  
  -- Даем права authenticated
  GRANT EXECUTE ON FUNCTION check_table_opens_limit(UUID) TO authenticated;
  
  RAISE NOTICE 'Права для check_table_opens_limit обновлены';
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Ошибка при обновлении прав check_table_opens_limit: %', SQLERRM;
END $$;

-- Проверяем и исправляем права для increment_table_opens
DO $$ 
BEGIN
  -- Отзываем права у anon (если есть)
  REVOKE EXECUTE ON FUNCTION increment_table_opens(UUID, BOOLEAN) FROM anon;
  
  -- Даем права authenticated
  GRANT EXECUTE ON FUNCTION increment_table_opens(UUID, BOOLEAN) TO authenticated;
  
  RAISE NOTICE 'Права для increment_table_opens обновлены';
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Ошибка при обновлении прав increment_table_opens: %', SQLERRM;
END $$;

-- Проверяем и исправляем права для check_token_limit
DO $$ 
BEGIN
  -- Отзываем права у anon (если есть)
  REVOKE EXECUTE ON FUNCTION check_token_limit(UUID) FROM anon;
  
  -- Даем права authenticated
  GRANT EXECUTE ON FUNCTION check_token_limit(UUID) TO authenticated;
  
  RAISE NOTICE 'Права для check_token_limit обновлены';
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Ошибка при обновлении прав check_token_limit: %', SQLERRM;
END $$;

-- Проверяем и исправляем права для add_user_tokens
DO $$ 
BEGIN
  -- Отзываем права у anon (если есть)
  REVOKE EXECUTE ON FUNCTION add_user_tokens(UUID, INTEGER) FROM anon;
  
  -- Даем права authenticated
  GRANT EXECUTE ON FUNCTION add_user_tokens(UUID, INTEGER) TO authenticated;
  
  RAISE NOTICE 'Права для add_user_tokens обновлены';
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Ошибка при обновлении прав add_user_tokens: %', SQLERRM;
END $$;

-- Проверяем существование функций
SELECT 
  'check_table_opens_limit' as function_name,
  CASE WHEN EXISTS (
    SELECT 1 FROM pg_proc p
    JOIN pg_namespace n ON p.pronamespace = n.oid
    WHERE n.nspname = 'public' AND p.proname = 'check_table_opens_limit'
  ) THEN '✅ Существует' ELSE '❌ Не найдена' END as status
UNION ALL
SELECT 
  'increment_table_opens',
  CASE WHEN EXISTS (
    SELECT 1 FROM pg_proc p
    JOIN pg_namespace n ON p.pronamespace = n.oid
    WHERE n.nspname = 'public' AND p.proname = 'increment_table_opens'
  ) THEN '✅ Существует' ELSE '❌ Не найдена' END
UNION ALL
SELECT 
  'check_token_limit',
  CASE WHEN EXISTS (
    SELECT 1 FROM pg_proc p
    JOIN pg_namespace n ON p.pronamespace = n.oid
    WHERE n.nspname = 'public' AND p.proname = 'check_token_limit'
  ) THEN '✅ Существует' ELSE '❌ Не найдена' END
UNION ALL
SELECT 
  'add_user_tokens',
  CASE WHEN EXISTS (
    SELECT 1 FROM pg_proc p
    JOIN pg_namespace n ON p.pronamespace = n.oid
    WHERE n.nspname = 'public' AND p.proname = 'add_user_tokens'
  ) THEN '✅ Существует' ELSE '❌ Не найдена' END;

