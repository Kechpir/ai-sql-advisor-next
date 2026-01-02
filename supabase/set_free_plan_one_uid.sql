-- ===== УСТАНОВКА FREE ПЛАНА (UID В ОДНОМ МЕСТЕ) =====
-- ⚠️ ЗАМЕНИТЕ 'YOUR_USER_ID_HERE' НА ВАШ USER_ID ТОЛЬКО В СТРОКЕ 4

DO $$
DECLARE
  uid UUID := 'YOUR_USER_ID_HERE'::UUID; -- ⚠️ ЗАМЕНИТЕ НА ВАШ USER_ID!
  result_plan TEXT;
  result_status TEXT;
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
  
  -- Получаем результат для вывода
  SELECT plan, status INTO result_plan, result_status
  FROM subscriptions
  WHERE user_id = uid;
  
  -- Выводим результат
  RAISE NOTICE '✅ FREE план установлен для пользователя %', uid;
  RAISE NOTICE 'План: %, Статус: %', result_plan, result_status;
END $$;

