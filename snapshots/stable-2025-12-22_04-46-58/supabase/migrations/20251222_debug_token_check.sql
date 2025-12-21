-- Диагностические запросы для проверки лимита токенов
-- Выполните эти запросы в Supabase SQL Editor и пришлите результаты
-- ЗАМЕНИТЕ 'YOUR_USER_ID_HERE' на ваш UUID (можно найти в консоли браузера или в auth.users)

-- 1. Проверка данных пользователя в user_token_usage
SELECT 
  user_id,
  tokens_used,
  updated_at,
  CASE 
    WHEN tokens_used IS NULL THEN 'NULL (нет записи)'
    ELSE tokens_used::TEXT
  END as tokens_used_status
FROM user_token_usage
WHERE user_id = 'YOUR_USER_ID_HERE';

-- 2. Проверка подписки пользователя
SELECT 
  user_id,
  plan,
  status,
  current_period_start,
  current_period_end,
  CASE 
    WHEN current_period_end > NOW() THEN 'Активна'
    ELSE 'Истекла'
  END as subscription_status
FROM subscriptions
WHERE user_id = 'YOUR_USER_ID_HERE'
ORDER BY created_at DESC;

-- 3. Проверка функции check_token_limit (ГЛАВНЫЙ ЗАПРОС!)
SELECT 
  within_limit,
  tokens_used,
  token_limit,
  purchased_tokens,
  total_limit,
  remaining,
  CASE 
    WHEN remaining <= 0 THEN '❌ НЕТ ТОКЕНОВ'
    WHEN remaining > 0 AND remaining < 1000 THEN '⚠️ МАЛО ТОКЕНОВ'
    ELSE '✅ ЕСТЬ ТОКЕНЫ'
  END as status
FROM check_token_limit('YOUR_USER_ID_HERE');

-- 4. Проверка функции get_available_tokens
SELECT * FROM get_available_tokens('YOUR_USER_ID_HERE');

-- 5. Проверка лимитов плана
SELECT 
  plan,
  token_limit,
  period_days
FROM pricing_plans
ORDER BY plan;

-- 6. Проверка purchased_tokens (дополнительные токены)
SELECT 
  user_id,
  tokens_amount,
  is_active,
  subscription_period_id,
  created_at
FROM purchased_tokens
WHERE user_id = 'YOUR_USER_ID_HERE'
ORDER BY created_at DESC;

