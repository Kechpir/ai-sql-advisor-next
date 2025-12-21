-- Быстрая настройка пользователя для тестирования
-- ЗАМЕНИ 'YOUR_USER_ID_HERE' на свой UUID из Supabase Dashboard → Authentication → Users

-- FREE план (90K токенов, 17 открытий, 17 скачиваний) - почти на лимите
DO $$
DECLARE
  uid UUID := 'YOUR_USER_ID_HERE'::UUID; -- ⚠️ ЗАМЕНИ НА СВОЙ UUID!
BEGIN
  -- Подписка
  INSERT INTO subscriptions (user_id, plan, status, current_period_start, current_period_end)
  VALUES (uid, 'free', 'active', NOW(), NOW() + INTERVAL '3 days')
  ON CONFLICT (user_id) DO UPDATE SET 
    plan = EXCLUDED.plan, 
    status = EXCLUDED.status, 
    current_period_start = EXCLUDED.current_period_start, 
    current_period_end = EXCLUDED.current_period_end;
  
  -- Токены (90K из 100K лимита)
  INSERT INTO user_token_usage (user_id, tokens_used, period_start, period_end)
  VALUES (uid, 90000, NOW(), NOW() + INTERVAL '3 days')
  ON CONFLICT (user_id) DO UPDATE SET 
    tokens_used = EXCLUDED.tokens_used, 
    period_start = EXCLUDED.period_start, 
    period_end = EXCLUDED.period_end;
  
  -- Открытия (17 из 20 лимита)
  INSERT INTO user_table_opens (user_id, opens_count, downloads_count, period_start, period_end)
  VALUES (uid, 17, 17, NOW(), NOW() + INTERVAL '3 days')
  ON CONFLICT (user_id) DO UPDATE SET 
    opens_count = EXCLUDED.opens_count, 
    downloads_count = EXCLUDED.downloads_count, 
    period_start = EXCLUDED.period_start, 
    period_end = EXCLUDED.period_end;
    
  RAISE NOTICE '✅ FREE план настроен для пользователя %', uid;
END $$;

