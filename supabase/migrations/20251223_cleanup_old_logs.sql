-- Миграция для автоматической очистки старых логов в зависимости от плана пользователя
-- Light: 30 дней, Pro: 90 дней, Free: 30 дней (по умолчанию)

-- Функция для очистки старых логов
CREATE OR REPLACE FUNCTION cleanup_old_query_logs()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Удаляем логи старше 30 дней для пользователей с планом 'free' или 'light'
  DELETE FROM user_query_logs
  WHERE created_at < NOW() - INTERVAL '30 days'
    AND user_id IN (
      SELECT user_id 
      FROM subscriptions 
      WHERE plan IN ('free', 'light') 
        AND status = 'active'
    );

  -- Удаляем логи старше 90 дней для пользователей с планом 'pro'
  DELETE FROM user_query_logs
  WHERE created_at < NOW() - INTERVAL '90 days'
    AND user_id IN (
      SELECT user_id 
      FROM subscriptions 
      WHERE plan = 'pro' 
        AND status = 'active'
    );

  -- Для пользователей без подписки или с неактивной подпиской удаляем логи старше 30 дней
  DELETE FROM user_query_logs
  WHERE created_at < NOW() - INTERVAL '30 days'
    AND user_id NOT IN (
      SELECT DISTINCT user_id 
      FROM subscriptions 
      WHERE status = 'active'
    );
END;
$$;

-- Комментарий к функции
COMMENT ON FUNCTION cleanup_old_query_logs() IS 'Очищает старые логи запросов: 30 дней для free/light, 90 дней для pro';

-- Можно настроить pg_cron для автоматического запуска (требуется расширение pg_cron)
-- Раскомментируйте, если у вас установлено расширение pg_cron:
-- SELECT cron.schedule('cleanup-old-logs', '0 3 * * *', 'SELECT cleanup_old_query_logs();');
-- (запуск каждый день в 3:00)

