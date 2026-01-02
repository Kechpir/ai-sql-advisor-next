-- ===== ИСПРАВЛЕНИЕ ПОЛИТИКИ UPDATE ДЛЯ subscriptions =====
-- Если UPDATE не работает из-за RLS, выполните этот скрипт

-- 1. Проверка текущих политик UPDATE
SELECT 
  policyname,
  cmd,
  qual,
  with_check
FROM pg_policies
WHERE tablename = 'subscriptions' 
  AND cmd = 'UPDATE';

-- 2. Если политики UPDATE нет или она не работает, создадим/обновим её
DROP POLICY IF EXISTS "Users can update their own subscription" ON subscriptions;

CREATE POLICY "Users can update their own subscription"
  ON subscriptions FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- 3. Альтернатива: разрешить service_role обновлять (для админских операций)
DROP POLICY IF EXISTS "Service role can update subscriptions" ON subscriptions;

CREATE POLICY "Service role can update subscriptions"
  ON subscriptions FOR UPDATE
  TO service_role
  USING (true)
  WITH CHECK (true);

-- 4. Теперь попробуйте обновить подписку снова
UPDATE subscriptions
SET 
  plan = 'pro',
  status = 'active',
  current_period_start = NOW(),
  current_period_end = NOW() + INTERVAL '30 days',
  updated_at = NOW()
WHERE user_id = '2a167d67-d929-4dfc-a5fe-8a2835e35d02';

-- 5. Проверка результата
SELECT 
  id,
  user_id,
  plan,
  status,
  current_period_start,
  current_period_end,
  current_period_end > NOW() as is_active_period
FROM subscriptions
WHERE user_id = '2a167d67-d929-4dfc-a5fe-8a2835e35d02';

