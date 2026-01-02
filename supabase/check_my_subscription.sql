-- ===== ПРОВЕРКА ВАШЕЙ ПОДПИСКИ =====
-- Выполните этот скрипт в SQL Editor Supabase

-- 1. Получите ваш user_id из auth.users
SELECT 
  id as user_id,
  email,
  created_at
FROM auth.users
ORDER BY created_at DESC
LIMIT 5;

-- 2. Проверьте, есть ли у вас подписка (замените YOUR_USER_ID на ваш user_id из шага 1)
-- Скопируйте user_id из результата выше и вставьте в запрос ниже
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
WHERE user_id = 'YOUR_USER_ID_HERE'; -- ЗАМЕНИТЕ НА ВАШ USER_ID

-- 3. Если подписки нет, создайте её (замените YOUR_USER_ID на ваш user_id)
INSERT INTO subscriptions (user_id, plan, status, current_period_start, current_period_end)
VALUES (
  'YOUR_USER_ID_HERE', -- ЗАМЕНИТЕ НА ВАШ USER_ID
  'free',
  'active',
  NOW(),
  NOW() + INTERVAL '30 days'
)
ON CONFLICT (user_id) DO UPDATE SET
  plan = EXCLUDED.plan,
  status = EXCLUDED.status,
  current_period_start = EXCLUDED.current_period_start,
  current_period_end = EXCLUDED.current_period_end,
  updated_at = NOW()
RETURNING *;

-- 4. Проверьте, что подписка создана
SELECT 
  id,
  user_id,
  plan,
  status,
  current_period_start,
  current_period_end,
  current_period_end > NOW() as is_active_period
FROM subscriptions
WHERE user_id = 'YOUR_USER_ID_HERE'; -- ЗАМЕНИТЕ НА ВАШ USER_ID

