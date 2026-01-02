-- ===== ПРОВЕРКА ПЛАНА ПОДПИСКИ ПО USER_ID =====
-- Замените 'YOUR_USER_ID_HERE' на ваш user_id

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
WHERE user_id = 'YOUR_USER_ID_HERE'; -- ⚠️ ЗАМЕНИТЕ НА ВАШ USER_ID

-- ===== БЫСТРАЯ ПРОВЕРКА (только план и статус) =====
SELECT 
  plan,
  status,
  current_period_end > NOW() as is_active
FROM subscriptions
WHERE user_id = 'YOUR_USER_ID_HERE'; -- ⚠️ ЗАМЕНИТЕ НА ВАШ USER_ID

-- ===== ДЛЯ ВАШЕГО USER_ID (2a167d67-d929-4dfc-a5fe-8a2835e35d02) =====
SELECT 
  plan,
  status,
  current_period_end > NOW() as is_active,
  current_period_end
FROM subscriptions
WHERE user_id = '2a167d67-d929-4dfc-a5fe-8a2835e35d02';

