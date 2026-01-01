-- Быстрая настройка пользователя для тестирования PRO плана
-- ЗАМЕНИ 'YOUR_USER_ID_HERE' на свой UUID из Supabase Dashboard → Authentication → Users

-- PRO план (2.4M токенов из 2.6M лимита, открытия и скачивания безлимитны)
DO $$
DECLARE
  uid UUID := '080a9e98-3ecf-4ae6-b6a3-999ddf198fdc'::UUID; -- ⚠️ ЗАМЕНИ НА СВОЙ UUID!
BEGIN
  -- Подписка PRO
  INSERT INTO subscriptions (user_id, plan, status, current_period_start, current_period_end)
  VALUES (uid, 'pro', 'active', NOW(), NOW() + INTERVAL '30 days')
  ON CONFLICT (user_id) DO UPDATE SET 
    plan = EXCLUDED.plan, 
    status = EXCLUDED.status, 
    current_period_start = EXCLUDED.current_period_start, 
    current_period_end = EXCLUDED.current_period_end;
  
  -- Токены (2.4M из 2.6M лимита для PRO - почти на лимите)
  INSERT INTO user_token_usage (user_id, tokens_used, period_start, period_end)
  VALUES (uid, 2400000, NOW(), NOW() + INTERVAL '30 days')
  ON CONFLICT (user_id) DO UPDATE SET 
    tokens_used = EXCLUDED.tokens_used, 
    period_start = EXCLUDED.period_start, 
    period_end = EXCLUDED.period_end;
  
  -- Открытия и скачивания (для PRO безлимит, но для тестирования ставим значения)
  INSERT INTO user_table_opens (user_id, opens_count, downloads_count, period_start, period_end)
  VALUES (uid, 0, 0, NOW(), NOW() + INTERVAL '30 days')
  ON CONFLICT (user_id) DO UPDATE SET 
    opens_count = EXCLUDED.opens_count, 
    downloads_count = EXCLUDED.downloads_count, 
    period_start = EXCLUDED.period_start, 
    period_end = EXCLUDED.period_end;
    
  RAISE NOTICE '✅ PRO план настроен для пользователя %', uid;
  RAISE NOTICE 'Токены: 2.4M из 2.6M (лимит), Открытия и скачивания: безлимит';
END $$;

