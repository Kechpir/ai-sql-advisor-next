-- Тестовый скрипт для настройки пользователя с тестовыми данными
-- Использование: замените 'YOUR_USER_ID' на UUID вашего пользователя из auth.users
-- Затем выполните этот скрипт в Supabase SQL Editor

-- ===== Параметры для настройки =====
-- Замените на ваш user_id (можно найти в Supabase Dashboard -> Authentication -> Users)
DO $$
DECLARE
  test_user_id UUID := 'YOUR_USER_ID'::UUID; -- ЗАМЕНИТЕ НА ВАШ USER_ID
  test_plan TEXT := 'free'; -- 'free', 'light', 'pro'
  test_tokens_used INTEGER := 90000; -- Количество использованных токенов (для free лимит 100K)
  test_opens_count INTEGER := 17; -- Количество открытий таблиц (для free лимит 20)
  test_downloads_count INTEGER := 17; -- Количество скачиваний (для free лимит 20)
  period_start TIMESTAMPTZ;
  period_end TIMESTAMPTZ;
BEGIN
  -- Вычисляем период в зависимости от плана
  period_start := NOW();
  CASE test_plan
    WHEN 'free' THEN
      period_end := NOW() + INTERVAL '3 days';
    WHEN 'light' THEN
      period_end := NOW() + INTERVAL '30 days';
    WHEN 'pro' THEN
      period_end := NOW() + INTERVAL '30 days';
    ELSE
      period_end := NOW() + INTERVAL '3 days';
  END CASE;

  -- Обновляем или создаем подписку
  INSERT INTO subscriptions (
    user_id,
    plan,
    status,
    current_period_start,
    current_period_end,
    created_at,
    updated_at
  )
  VALUES (
    test_user_id,
    test_plan,
    'active',
    period_start,
    period_end,
    NOW(),
    NOW()
  )
  ON CONFLICT (user_id) 
  DO UPDATE SET
    plan = test_plan,
    status = 'active',
    current_period_start = period_start,
    current_period_end = period_end,
    updated_at = NOW();

  -- Обновляем или создаем учет токенов
  INSERT INTO user_token_usage (
    user_id,
    tokens_used,
    period_start,
    period_end,
    created_at,
    updated_at
  )
  VALUES (
    test_user_id,
    test_tokens_used,
    period_start,
    period_end,
    NOW(),
    NOW()
  )
  ON CONFLICT (user_id) 
  DO UPDATE SET
    tokens_used = EXCLUDED.tokens_used,
    period_start = EXCLUDED.period_start,
    period_end = EXCLUDED.period_end,
    updated_at = NOW();

  -- Обновляем или создаем счетчик открытий таблиц
  INSERT INTO user_table_opens (
    user_id,
    opens_count,
    downloads_count,
    period_start,
    period_end,
    created_at,
    updated_at
  )
  VALUES (
    test_user_id,
    test_opens_count,
    test_downloads_count,
    period_start,
    period_end,
    NOW(),
    NOW()
  )
  ON CONFLICT (user_id) 
  DO UPDATE SET
    opens_count = EXCLUDED.opens_count,
    downloads_count = EXCLUDED.downloads_count,
    period_start = EXCLUDED.period_start,
    period_end = EXCLUDED.period_end,
    updated_at = NOW();

  RAISE NOTICE '✅ Пользователь % настроен:', test_user_id;
  RAISE NOTICE '   План: %', test_plan;
  RAISE NOTICE '   Использовано токенов: %', test_tokens_used;
  RAISE NOTICE '   Открытий таблиц: %', test_opens_count;
  RAISE NOTICE '   Скачиваний: %', test_downloads_count;
  RAISE NOTICE '   Период: % - %', period_start, period_end;
END $$;

-- ===== Быстрые команды для разных тарифов =====
-- Скопируйте нужную команду и замените YOUR_USER_ID

-- FREE план (90K токенов, 17 открытий, 17 скачиваний)
/*
DO $$
DECLARE
  uid UUID := 'YOUR_USER_ID'::UUID;
BEGIN
  -- Подписка
  INSERT INTO subscriptions (user_id, plan, status, current_period_start, current_period_end)
  VALUES (uid, 'free', 'active', NOW(), NOW() + INTERVAL '3 days')
  ON CONFLICT (user_id) DO UPDATE SET plan = EXCLUDED.plan, status = EXCLUDED.status, current_period_start = EXCLUDED.current_period_start, current_period_end = EXCLUDED.current_period_end;
  
  -- Токены
  INSERT INTO user_token_usage (user_id, tokens_used, period_start, period_end)
  VALUES (uid, 90000, NOW(), NOW() + INTERVAL '3 days')
  ON CONFLICT (user_id) DO UPDATE SET tokens_used = EXCLUDED.tokens_used, period_start = EXCLUDED.period_start, period_end = EXCLUDED.period_end;
  
  -- Открытия
  INSERT INTO user_table_opens (user_id, opens_count, downloads_count, period_start, period_end)
  VALUES (uid, 17, 17, NOW(), NOW() + INTERVAL '3 days')
  ON CONFLICT (user_id) DO UPDATE SET opens_count = EXCLUDED.opens_count, downloads_count = EXCLUDED.downloads_count, period_start = EXCLUDED.period_start, period_end = EXCLUDED.period_end;
END $$;
*/

-- LIGHT план (1.2M токенов, 45 открытий, 45 скачиваний)
/*
DO $$
DECLARE
  uid UUID := 'YOUR_USER_ID'::UUID;
BEGIN
  INSERT INTO subscriptions (user_id, plan, status, current_period_start, current_period_end)
  VALUES (uid, 'light', 'active', NOW(), NOW() + INTERVAL '30 days')
  ON CONFLICT (user_id) DO UPDATE SET plan = 'light', status = 'active', current_period_start = NOW(), current_period_end = NOW() + INTERVAL '30 days';
  
  INSERT INTO user_token_usage (user_id, tokens_used, period_start, period_end)
  VALUES (uid, 1200000, NOW(), NOW() + INTERVAL '30 days')
  ON CONFLICT (user_id) DO UPDATE SET tokens_used = 1200000, period_start = NOW(), period_end = NOW() + INTERVAL '30 days';
  
  INSERT INTO user_table_opens (user_id, opens_count, downloads_count, period_start, period_end)
  VALUES (uid, 45, 45, NOW(), NOW() + INTERVAL '30 days')
  ON CONFLICT (user_id) DO UPDATE SET opens_count = 45, downloads_count = 45, period_start = NOW(), period_end = NOW() + INTERVAL '30 days';
END $$;
*/

-- PRO план (2.5M токенов, безлимитные открытия)
/*
DO $$
DECLARE
  uid UUID := 'YOUR_USER_ID'::UUID;
BEGIN
  INSERT INTO subscriptions (user_id, plan, status, current_period_start, current_period_end)
  VALUES (uid, 'pro', 'active', NOW(), NOW() + INTERVAL '30 days')
  ON CONFLICT (user_id) DO UPDATE SET plan = 'pro', status = 'active', current_period_start = NOW(), current_period_end = NOW() + INTERVAL '30 days';
  
  INSERT INTO user_token_usage (user_id, tokens_used, period_start, period_end)
  VALUES (uid, 2500000, NOW(), NOW() + INTERVAL '30 days')
  ON CONFLICT (user_id) DO UPDATE SET tokens_used = 2500000, period_start = NOW(), period_end = NOW() + INTERVAL '30 days';
  
  INSERT INTO user_table_opens (user_id, opens_count, downloads_count, period_start, period_end)
  VALUES (uid, 0, 0, NOW(), NOW() + INTERVAL '30 days')
  ON CONFLICT (user_id) DO UPDATE SET opens_count = 0, downloads_count = 0, period_start = NOW(), period_end = NOW() + INTERVAL '30 days';
END $$;
*/

