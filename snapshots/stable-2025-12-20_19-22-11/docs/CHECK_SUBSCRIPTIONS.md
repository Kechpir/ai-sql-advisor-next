# 🔍 Проверка подписок пользователей

## ✅ Способ 1: Через Supabase SQL Editor (САМЫЙ ПРОСТОЙ)

### Откройте SQL Editor:
1. Перейдите на https://supabase.com/dashboard/project/zaheofzxbfqabdxdmjtz
2. В левом меню выберите **"SQL Editor"**

### Запрос 1: Все подписки с информацией о пользователях

```sql
-- Показать все подписки с email пользователей
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
  END as subscription_status,
  s.created_at,
  s.updated_at
FROM subscriptions s
LEFT JOIN auth.users u ON s.user_id = u.id
ORDER BY s.created_at DESC;
```

### Запрос 2: Только активные подписки

```sql
-- Показать только активные подписки
SELECT 
  s.id,
  s.user_id,
  u.email,
  s.plan,
  s.status,
  s.current_period_start,
  s.current_period_end,
  s.created_at
FROM subscriptions s
LEFT JOIN auth.users u ON s.user_id = u.id
WHERE s.status = 'active'
  AND s.current_period_end > NOW()
ORDER BY s.current_period_end DESC;
```

### Запрос 3: Статистика по тарифам

```sql
-- Статистика: сколько пользователей на каждом тарифе
SELECT 
  plan,
  status,
  COUNT(*) as user_count,
  COUNT(CASE WHEN current_period_end > NOW() THEN 1 END) as active_count
FROM subscriptions
GROUP BY plan, status
ORDER BY plan, status;
```

### Запрос 4: Подписки конкретного пользователя (по email)

```sql
-- Замените 'user@example.com' на нужный email
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
WHERE u.email = 'user@example.com';
```

### Запрос 5: Подписки конкретного пользователя (по UUID)

```sql
-- Замените 'USER_UUID' на UUID пользователя
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
WHERE s.user_id = 'USER_UUID';
```

---

## 🔧 Способ 2: Через Supabase CLI

### Создайте файл `check_subscriptions.sql`:

```sql
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
ORDER BY s.created_at DESC;
```

### Выполните через CLI:

```bash
# 1. Перейдите в корень проекта
cd c:\Users\Full_Errorist\Documents\GitHub\ai-sql-advisor-next

# 2. Выполните SQL запрос
supabase db execute --file check_subscriptions.sql
```

---

## 🐍 Способ 3: Через Python скрипт (опционально)

Создайте файл `check_subscriptions.py`:

```python
import os
from supabase import create_client, Client

SUPABASE_URL = os.environ.get("SUPABASE_URL", "https://zaheofzxbfqabdxdmjtz.supabase.co")
SUPABASE_KEY = os.environ.get("SUPABASE_SERVICE_ROLE_KEY")  # Нужен SERVICE_ROLE_KEY

if not SUPABASE_KEY:
    print("❌ Установите SUPABASE_SERVICE_ROLE_KEY в переменные окружения")
    exit(1)

supabase: Client = create_client(SUPABASE_URL, SUPABASE_KEY)

# Получить все подписки
response = supabase.table("subscriptions").select("*").execute()

print(f"\n📊 Всего подписок: {len(response.data)}\n")

for sub in response.data:
    user_id = sub["user_id"]
    plan = sub["plan"]
    status = sub["status"]
    period_end = sub["current_period_end"]
    
    # Проверить активность
    from datetime import datetime
    is_active = datetime.fromisoformat(period_end.replace('Z', '+00:00')) > datetime.now()
    
    print(f"User ID: {user_id}")
    print(f"Plan: {plan}")
    print(f"Status: {status}")
    print(f"Active: {'✅ Да' if is_active else '❌ Нет'}")
    print(f"Period End: {period_end}")
    print("-" * 50)
```

Запуск:
```bash
pip install supabase
python check_subscriptions.py
```

---

## 📊 Полезные запросы для мониторинга

### Запрос: Подписки, которые скоро истекают (в течение 7 дней)

```sql
-- Подписки, которые истекают в ближайшие 7 дней
SELECT 
  s.user_id,
  u.email,
  s.plan,
  s.current_period_end,
  s.current_period_end - NOW() as days_remaining
FROM subscriptions s
LEFT JOIN auth.users u ON s.user_id = u.id
WHERE s.status = 'active'
  AND s.current_period_end > NOW()
  AND s.current_period_end <= NOW() + INTERVAL '7 days'
ORDER BY s.current_period_end ASC;
```

### Запрос: Пользователи без подписки

```sql
-- Пользователи, у которых нет активной подписки
SELECT 
  u.id,
  u.email,
  u.created_at as user_created_at
FROM auth.users u
LEFT JOIN subscriptions s ON u.id = s.user_id 
  AND s.status = 'active' 
  AND s.current_period_end > NOW()
WHERE s.id IS NULL
ORDER BY u.created_at DESC;
```

### Запрос: История использования API по пользователям

```sql
-- Статистика использования API по пользователям
SELECT 
  u.email,
  l.function_name,
  COUNT(*) as usage_count,
  SUM(l.tokens_used) as total_tokens,
  MAX(l.created_at) as last_used
FROM api_usage_logs l
LEFT JOIN auth.users u ON l.user_id = u.id
GROUP BY u.email, l.function_name
ORDER BY usage_count DESC;
```

---

## 🎯 Быстрая проверка одной команды

Самый простой запрос для быстрой проверки:

```sql
SELECT 
  COUNT(*) as total_subscriptions,
  COUNT(CASE WHEN status = 'active' AND current_period_end > NOW() THEN 1 END) as active_subscriptions,
  COUNT(CASE WHEN plan = 'free' THEN 1 END) as free_plan,
  COUNT(CASE WHEN plan = 'pro' THEN 1 END) as pro_plan,
  COUNT(CASE WHEN plan = 'team' THEN 1 END) as team_plan
FROM subscriptions;
```

Этот запрос покажет:
- Общее количество подписок
- Количество активных подписок
- Распределение по тарифам

---

## ✅ Рекомендация

**Используйте Способ 1 (SQL Editor)** - это самый простой и быстрый способ проверить подписки.

Скопируйте любой из запросов выше, вставьте в SQL Editor и нажмите **Run**.
