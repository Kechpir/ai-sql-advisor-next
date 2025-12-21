# 🔧 Исправление ошибки "Subscription required"

## ❌ Проблема

Ошибка: `❌ Ошибка Supabase (403): Subscription required`

**Причина:** Edge Function не находит активную подписку в таблице `subscriptions` для вашего пользователя.

---

## 🔍 Диагностика

### Шаг 1: Проверьте ваш User ID

1. Откройте консоль браузера (F12)
2. Выполните:

```javascript
// Получить JWT токен
const token = localStorage.getItem('jwt');
console.log('JWT токен:', token ? token.substring(0, 50) + '...' : 'НЕТ');

// Декодировать JWT и получить user_id
if (token) {
  const parts = token.split('.');
  if (parts.length === 3) {
    const payload = JSON.parse(atob(parts[1].replace(/-/g, '+').replace(/_/g, '/')));
    console.log('User ID:', payload.sub);
    console.log('Email:', payload.email);
  }
}
```

**Скопируйте User ID** - он понадобится дальше.

---

### Шаг 2: Проверьте подписку в Supabase

1. Откройте: https://supabase.com/dashboard/project/zaheofzxbfqabdxdmjtz
2. Перейдите в **SQL Editor**
3. Выполните запрос (замените `YOUR_USER_ID` на ваш User ID из шага 1):

```sql
-- Проверить подписку пользователя
SELECT 
  s.id,
  s.user_id,
  u.email,
  s.plan,
  s.status,
  s.current_period_start,
  s.current_period_end,
  CASE 
    WHEN s.current_period_end > NOW() THEN '✅ Активна'
    ELSE '❌ Истекла'
  END as subscription_status
FROM subscriptions s
LEFT JOIN auth.users u ON s.user_id = u.id
WHERE s.user_id = 'YOUR_USER_ID';
```

**Результат:**
- Если записей нет → нужно создать подписку (см. Шаг 3)
- Если запись есть, но `status != 'active'` → нужно обновить статус
- Если запись есть, но `current_period_end < NOW()` → нужно продлить подписку

---

### Шаг 3: Создайте или обновите подписку

#### Вариант A: Создать новую подписку

```sql
-- Создать подписку Pro для пользователя
INSERT INTO subscriptions (user_id, plan, status, current_period_start, current_period_end)
VALUES (
  'YOUR_USER_ID',  -- Замените на ваш User ID
  'pro',           -- или 'free', 'team'
  'active',
  NOW(),
  NOW() + INTERVAL '30 days'  -- Подписка на 30 дней
)
ON CONFLICT (user_id) 
DO UPDATE SET
  plan = EXCLUDED.plan,
  status = EXCLUDED.status,
  current_period_start = EXCLUDED.current_period_start,
  current_period_end = EXCLUDED.current_period_end,
  updated_at = NOW();
```

#### Вариант B: Обновить существующую подписку

```sql
-- Обновить существующую подписку
UPDATE subscriptions
SET 
  plan = 'pro',
  status = 'active',
  current_period_start = NOW(),
  current_period_end = NOW() + INTERVAL '30 days',
  updated_at = NOW()
WHERE user_id = 'YOUR_USER_ID';  -- Замените на ваш User ID
```

#### Вариант C: Продлить истекшую подписку

```sql
-- Продлить подписку, если она истекла
UPDATE subscriptions
SET 
  status = 'active',
  current_period_start = NOW(),
  current_period_end = NOW() + INTERVAL '30 days',
  updated_at = NOW()
WHERE user_id = 'YOUR_USER_ID'  -- Замените на ваш User ID
  AND current_period_end < NOW();
```

---

### Шаг 4: Проверьте результат

После создания/обновления подписки, выполните снова:

```sql
-- Проверить подписку после обновления
SELECT 
  s.id,
  s.user_id,
  u.email,
  s.plan,
  s.status,
  s.current_period_start,
  s.current_period_end,
  CASE 
    WHEN s.status = 'active' AND s.current_period_end > NOW() THEN '✅ Активна'
    WHEN s.status = 'active' AND s.current_period_end <= NOW() THEN '⚠️ Истекла'
    ELSE '❌ Неактивна'
  END as subscription_status
FROM subscriptions s
LEFT JOIN auth.users u ON s.user_id = u.id
WHERE s.user_id = 'YOUR_USER_ID';
```

**Должно показать:** `✅ Активна`

---

### Шаг 5: Обновите страницу и попробуйте снова

1. Обновите страницу приложения (F5)
2. Попробуйте сгенерировать SQL запрос снова

---

## 🎯 Быстрое решение (одна команда)

Если вы знаете свой User ID, выполните это в SQL Editor:

```sql
-- Создать/обновить подписку Pro (замените YOUR_USER_ID)
INSERT INTO subscriptions (user_id, plan, status, current_period_start, current_period_end)
VALUES (
  'YOUR_USER_ID',
  'pro',
  'active',
  NOW(),
  NOW() + INTERVAL '30 days'
)
ON CONFLICT (user_id) 
DO UPDATE SET
  plan = 'pro',
  status = 'active',
  current_period_start = NOW(),
  current_period_end = NOW() + INTERVAL '30 days',
  updated_at = NOW();
```

---

## 🔍 Как найти User ID, если не знаете

### Способ 1: Через консоль браузера

```javascript
const token = localStorage.getItem('jwt');
if (token) {
  const parts = token.split('.');
  if (parts.length === 3) {
    const payload = JSON.parse(atob(parts[1].replace(/-/g, '+').replace(/_/g, '/')));
    console.log('User ID:', payload.sub);
  }
}
```

### Способ 2: Через SQL Editor

```sql
-- Показать всех пользователей
SELECT id, email, created_at 
FROM auth.users 
ORDER BY created_at DESC;
```

Найдите свой email и скопируйте `id` (это и есть User ID).

---

## ⚠️ Частые проблемы

### Проблема 1: "relation subscriptions does not exist"

**Причина:** Миграция не применена  
**Решение:** Примените миграцию `supabase/migrations/20251219_security_tables.sql` (см. `APPLY_MIGRATIONS.md`)

### Проблема 2: Подписка создана, но все равно ошибка 403

**Проверьте:**
1. `status` должен быть `'active'` (не `'canceled'` или `'expired'`)
2. `current_period_end` должен быть больше `NOW()`
3. `user_id` должен точно совпадать с User ID из JWT токена

**Исправление:**
```sql
-- Проверить все условия
SELECT 
  user_id,
  plan,
  status,
  current_period_end,
  current_period_end > NOW() as is_not_expired,
  status = 'active' as is_active
FROM subscriptions
WHERE user_id = 'YOUR_USER_ID';
```

### Проблема 3: JWT токен не передается

**Проверьте в консоли браузера:**
```javascript
console.log('JWT:', localStorage.getItem('jwt'));
```

Если `null` → нужно перелогиниться через `/auth`

---

## ✅ Чек-лист исправления

- [ ] Найден User ID из JWT токена
- [ ] Проверена таблица `subscriptions` в Supabase
- [ ] Создана/обновлена подписка с правильным `user_id`
- [ ] `status = 'active'`
- [ ] `current_period_end > NOW()`
- [ ] Страница обновлена (F5)
- [ ] Попробовано снова сгенерировать SQL

---

## 📞 Если проблема не решена

1. Проверьте логи Edge Function в Supabase Dashboard:
   - Edge Functions → `generate_sql` → Logs
   - Ищите ошибки в логах

2. Проверьте, что миграция применена:
   ```sql
   SELECT table_name 
   FROM information_schema.tables 
   WHERE table_schema = 'public' 
     AND table_name = 'subscriptions';
   ```
   
   Должна вернуть строку с `subscriptions`

3. Проверьте RLS политики:
   ```sql
   SELECT * FROM pg_policies WHERE tablename = 'subscriptions';
   ```

---

## 🎯 Итог

**Самое важное:** Убедитесь, что в таблице `subscriptions` есть запись с:
- ✅ Вашим `user_id` (из JWT токена)
- ✅ `status = 'active'`
- ✅ `current_period_end > NOW()`

После этого ошибка должна исчезнуть! 🎉
