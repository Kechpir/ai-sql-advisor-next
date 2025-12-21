-- Скрипт для проверки и исправления функций и таблиц
-- Выполните этот скрипт в SQL Editor для проверки, что всё правильно настроено

-- ===== 1. Проверка типа колонки subscription_period_id =====
SELECT 
  CASE 
    WHEN EXISTS (
      SELECT 1 FROM information_schema.columns 
      WHERE table_name = 'purchased_tokens' 
      AND column_name = 'subscription_period_id' 
      AND data_type = 'uuid'
    ) THEN '⚠️ Колонка subscription_period_id имеет тип UUID, нужно изменить на TIMESTAMPTZ. Выполните: 20251222_fix_purchased_tokens_type.sql'
    WHEN EXISTS (
      SELECT 1 FROM information_schema.columns 
      WHERE table_name = 'purchased_tokens' 
      AND column_name = 'subscription_period_id' 
      AND data_type = 'timestamp with time zone'
    ) THEN '✅ Колонка subscription_period_id имеет правильный тип (TIMESTAMPTZ)'
    ELSE '❓ Колонка subscription_period_id не найдена или таблица purchased_tokens не существует'
  END as check_subscription_period_id;

-- ===== 2. Проверка функции check_token_limit =====
SELECT 
  CASE 
    WHEN EXISTS (
      SELECT 1 FROM pg_proc p
      JOIN pg_namespace n ON p.pronamespace = n.oid
      WHERE n.nspname = 'public'
      AND p.proname = 'check_token_limit'
      AND pg_get_function_arguments(p.oid) = 'user_uuid uuid'
      AND pg_get_function_result(p.oid) LIKE '%purchased_tokens%'
    ) THEN '✅ Функция check_token_limit обновлена правильно (с purchased_tokens)'
    WHEN EXISTS (
      SELECT 1 FROM pg_proc p
      JOIN pg_namespace n ON p.pronamespace = n.oid
      WHERE n.nspname = 'public'
      AND p.proname = 'check_token_limit'
      AND pg_get_function_arguments(p.oid) = 'user_uuid uuid'
    ) THEN '⚠️ Функция check_token_limit существует, но имеет старый тип возврата. Нужно применить: 20251222_purchased_tokens.sql'
    ELSE '❌ Функция check_token_limit не найдена'
  END as check_token_limit_function;

-- ===== 3. Проверка таблицы purchased_tokens =====
SELECT 
  CASE 
    WHEN EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'purchased_tokens') 
    THEN '✅ Таблица purchased_tokens существует'
    ELSE '❌ Таблица purchased_tokens не найдена. Нужно применить: 20251222_purchased_tokens.sql'
  END as check_purchased_tokens_table;

-- ===== 4. Проверка функции setup_new_user =====
SELECT 
  CASE 
    WHEN EXISTS (
      SELECT 1 FROM pg_proc p
      JOIN pg_namespace n ON p.pronamespace = n.oid
      WHERE n.nspname = 'public'
      AND p.proname = 'setup_new_user'
    ) THEN '✅ Функция setup_new_user существует'
    ELSE '❌ Функция setup_new_user не найдена. Нужно применить: 20251222_auto_setup_new_users.sql'
  END as check_setup_new_user_function;

