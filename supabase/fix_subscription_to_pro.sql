-- ===== ИСПРАВЛЕНИЕ ПОДПИСКИ НА PRO ПЛАН =====
-- Выполните этот скрипт в SQL Editor Supabase

-- 1. Сначала проверим текущее состояние
SELECT 
  id,
  user_id,
  plan,
  status,
  current_period_start,
  current_period_end,
  current_period_end > NOW() as is_active_period
FROM subscriptions
WHERE user_id = '2a167d67-d929-4dfc-a5fe-8a2835e35d02';

-- 2. Обновим подписку на PRO план напрямую
UPDATE subscriptions
SET 
  plan = 'pro',
  status = 'active',
  current_period_start = NOW(),
  current_period_end = NOW() + INTERVAL '30 days',
  updated_at = NOW()
WHERE user_id = '2a167d67-d929-4dfc-a5fe-8a2835e35d02';

-- 3. Проверим, что обновление прошло успешно
SELECT 
  id,
  user_id,
  plan,
  status,
  current_period_start,
  current_period_end,
  current_period_end > NOW() as is_active_period,
  updated_at
FROM subscriptions
WHERE user_id = '2a167d67-d929-4dfc-a5fe-8a2835e35d02';

-- 4. Если запись не обновилась, создадим её заново (удалив старую)
-- ВНИМАНИЕ: Это удалит старую запись!
-- DELETE FROM subscriptions WHERE user_id = '2a167d67-d929-4dfc-a5fe-8a2835e35d02';

-- 5. Затем создадим новую запись с PRO планом
-- INSERT INTO subscriptions (user_id, plan, status, current_period_start, current_period_end)
-- VALUES (
--   '2a167d67-d929-4dfc-a5fe-8a2835e35d02',
--   'pro',
--   'active',
--   NOW(),
--   NOW() + INTERVAL '30 days'
-- );

