-- ===== УСТАНОВКА ПЛАНА (FREE/LIGHT/PRO) =====
-- ⚠️ ЗАМЕНИТЕ 'YOUR_USER_ID_HERE' НА ВАШ USER_ID
-- ⚠️ ЗАМЕНИТЕ 'light' НА 'free', 'light' ИЛИ 'pro'

DO $$
DECLARE
  uid UUID := 'YOUR_USER_ID_HERE'::UUID; -- ⚠️ ЗАМЕНИТЕ НА ВАШ USER_ID!
  plan_name TEXT := 'light'; -- ⚠️ 'free', 'light' или 'pro'
BEGIN
  -- Обновляем подписку
  UPDATE subscriptions
  SET 
    plan = plan_name,
    status = 'active',
    current_period_start = NOW(),
    current_period_end = NOW() + INTERVAL '30 days',
    updated_at = NOW()
  WHERE user_id = uid;
  
  -- Проверяем результат
  RAISE NOTICE '✅ План % установлен для пользователя %', plan_name, uid;
END $$;

-- Проверка результата (замените YOUR_USER_ID_HERE на ваш user_id)
SELECT 
  plan,
  status,
  current_period_end > NOW() as is_active,
  current_period_end
FROM subscriptions
WHERE user_id = 'YOUR_USER_ID_HERE'; -- ⚠️ ЗАМЕНИТЕ НА ВАШ USER_ID

