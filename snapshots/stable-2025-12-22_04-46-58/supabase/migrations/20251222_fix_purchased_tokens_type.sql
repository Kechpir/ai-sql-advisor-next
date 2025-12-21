-- Исправление типа subscription_period_id с UUID на TIMESTAMPTZ
-- Выполните этот скрипт в SQL Editor, если получили ошибку при настройке тестового пользователя

-- Обновляем тип колонки subscription_period_id
DO $$ 
BEGIN
  -- Проверяем, существует ли колонка и имеет ли тип UUID
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'purchased_tokens' 
    AND column_name = 'subscription_period_id' 
    AND data_type = 'uuid'
  ) THEN
    -- Удаляем все записи, так как конвертация UUID -> TIMESTAMPTZ невозможна
    -- Это нормально для тестовой таблицы
    DELETE FROM purchased_tokens;
    
    -- Меняем тип колонки
    ALTER TABLE purchased_tokens 
    ALTER COLUMN subscription_period_id TYPE TIMESTAMPTZ USING NULL;
    
    RAISE NOTICE 'Тип колонки subscription_period_id изменен с UUID на TIMESTAMPTZ';
  ELSE
    RAISE NOTICE 'Колонка subscription_period_id уже имеет правильный тип или не существует';
  END IF;
END $$;

