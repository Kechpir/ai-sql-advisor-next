-- ===== УСТАНОВКА LIGHT ПЛАНА (ПРОСТАЯ ВЕРСИЯ) =====
-- ⚠️ ЗАМЕНИТЕ 'YOUR_USER_ID_HERE' НА ВАШ USER_ID В ОДНОМ МЕСТЕ

WITH user_uid AS (
  SELECT 'YOUR_USER_ID_HERE'::UUID AS uid -- ⚠️ ЗАМЕНИТЕ НА ВАШ USER_ID!
)
UPDATE subscriptions
SET 
  plan = 'light',
  status = 'active',
  current_period_start = NOW(),
  current_period_end = NOW() + INTERVAL '30 days',
  updated_at = NOW()
FROM user_uid
WHERE subscriptions.user_id = user_uid.uid;

-- Проверка результата (используется тот же UID из CTE выше)
WITH user_uid AS (
  SELECT 'YOUR_USER_ID_HERE'::UUID AS uid -- ⚠️ ЗАМЕНИТЕ НА ВАШ USER_ID!
)
SELECT 
  plan,
  status,
  current_period_end > NOW() as is_active,
  current_period_end
FROM subscriptions, user_uid
WHERE subscriptions.user_id = user_uid.uid;

