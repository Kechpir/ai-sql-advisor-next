-- ===== УСТАНОВКА FREE ПЛАНА =====
-- ⚠️ ЗАМЕНИТЕ 'YOUR_USER_ID_HERE' НА ВАШ USER_ID В ОДНОМ МЕСТЕ (строка 4)

DO $$
DECLARE
  uid UUID := 'YOUR_USER_ID_HERE'::UUID; -- ⚠️ ЗАМЕНИТЕ НА ВАШ USER_ID!
BEGIN
  -- Обновляем подписку на FREE план
  UPDATE subscriptions
  SET 
    plan = 'free',
    status = 'active',
    current_period_start = NOW(),
    current_period_end = NOW() + INTERVAL '30 days',
    updated_at = NOW()
  WHERE user_id = uid;
  
  -- Проверяем результат
  RAISE NOTICE '✅ FREE план установлен для пользователя %', uid;
END $$;

-- Проверка результата (используется тот же UID из переменной выше)
-- Замените YOUR_USER_ID_HERE на тот же user_id, что указан в строке 4
SELECT 
  plan,
  status,
  current_period_end > NOW() as is_active,
  current_period_end
FROM subscriptions
WHERE user_id = 'YOUR_USER_ID_HERE'; -- ⚠️ ЗАМЕНИТЕ НА ВАШ USER_ID

