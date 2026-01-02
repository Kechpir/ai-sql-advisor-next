-- ===== УСТАНОВКА LIGHT ПЛАНА =====
-- ⚠️ ЗАМЕНИТЕ 'YOUR_USER_ID_HERE' НА ВАШ USER_ID В ОДНОМ МЕСТЕ (строка 4)

DO $$
DECLARE
  uid UUID := 'YOUR_USER_ID_HERE'::UUID; -- ⚠️ ЗАМЕНИТЕ НА ВАШ USER_ID!
BEGIN
  -- Обновляем подписку на LIGHT план
  UPDATE subscriptions
  SET 
    plan = 'light',
    status = 'active',
    current_period_start = NOW(),
    current_period_end = NOW() + INTERVAL '30 days',
    updated_at = NOW()
  WHERE user_id = uid;
  
  -- Проверяем результат
  RAISE NOTICE '✅ LIGHT план установлен для пользователя %', uid;
  
  -- Выводим информацию о подписке
  PERFORM 
    plan,
    status,
    current_period_end > NOW() as is_active
  FROM subscriptions
  WHERE user_id = uid;
END $$;

-- Проверка результата (замените YOUR_USER_ID_HERE на ваш user_id)
SELECT 
  plan,
  status,
  current_period_end > NOW() as is_active,
  current_period_end
FROM subscriptions
WHERE user_id = 'YOUR_USER_ID_HERE'; -- ⚠️ ЗАМЕНИТЕ НА ВАШ USER_ID

