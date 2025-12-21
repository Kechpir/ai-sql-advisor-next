-- Миграция для автоматической настройки новых пользователей
-- Функция вызывается при первом обращении пользователя к API (lazy initialization)

-- ===== Функция для автоматической настройки нового пользователя =====
CREATE OR REPLACE FUNCTION setup_new_user(user_uuid UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  period_start TIMESTAMPTZ;
  period_end TIMESTAMPTZ;
BEGIN
  -- Проверяем, существует ли пользователь
  IF NOT EXISTS (SELECT 1 FROM auth.users WHERE id = user_uuid) THEN
    RAISE EXCEPTION 'User not found: %', user_uuid;
  END IF;

  -- Вычисляем период для free плана (3 дня)
  period_start := NOW();
  period_end := NOW() + INTERVAL '3 days';

  -- Создаем подписку free для нового пользователя (если еще нет)
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
    user_uuid,
    'free',
    'active',
    period_start,
    period_end,
    NOW(),
    NOW()
  )
  ON CONFLICT (user_id) DO NOTHING; -- Если уже есть подписка, не перезаписываем

  -- Создаем запись для учета токенов (начальное значение: 0 использовано)
  INSERT INTO user_token_usage (
    user_id,
    tokens_used,
    period_start,
    period_end,
    created_at,
    updated_at
  )
  VALUES (
    user_uuid,
    0, -- Начальное количество использованных токенов
    period_start,
    period_end,
    NOW(),
    NOW()
  )
  ON CONFLICT (user_id) DO NOTHING; -- Если уже есть запись, не перезаписываем

  -- Создаем запись для счетчика открытий таблиц (начальное значение: 0)
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
    user_uuid,
    0, -- Начальное количество открытий
    0, -- Начальное количество скачиваний
    period_start,
    period_end,
    NOW(),
    NOW()
  )
  ON CONFLICT (user_id) DO NOTHING; -- Если уже есть запись, не перезаписываем

  RAISE NOTICE 'Настроен пользователь: % (free план, период: % - %)', user_uuid, period_start, period_end;
END;
$$;

-- ===== Функция для проверки и автоматической настройки (вызывается из API) =====
CREATE OR REPLACE FUNCTION ensure_user_setup(user_uuid UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Проверяем, есть ли подписка у пользователя
  IF NOT EXISTS (SELECT 1 FROM subscriptions WHERE user_id = user_uuid) THEN
    -- Если нет подписки, настраиваем пользователя
    PERFORM setup_new_user(user_uuid);
  END IF;
END;
$$;

-- Разрешаем вызов функций
GRANT EXECUTE ON FUNCTION setup_new_user(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION setup_new_user(UUID) TO anon;
GRANT EXECUTE ON FUNCTION ensure_user_setup(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION ensure_user_setup(UUID) TO anon;

-- Комментарии
COMMENT ON FUNCTION setup_new_user IS 'Настройка нового пользователя: создание free подписки, учет токенов и счетчика открытий';
COMMENT ON FUNCTION ensure_user_setup IS 'Проверка и автоматическая настройка пользователя при первом обращении к API';

