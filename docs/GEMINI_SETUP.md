# 🤖 Настройка Gemini API для тестирования

## Шаг 1: Получение API ключа Gemini

1. Перейдите на https://makersuite.google.com/app/apikey
2. Войдите в Google аккаунт
3. Нажмите "Create API Key"
4. Скопируйте ключ (формат: `AIzaSyC...`)

## Шаг 2: Добавление ключа в Supabase Secrets

**Важно:** Ключ должен храниться в Supabase Secrets, а не в `.env.local`!

### Через Supabase CLI:

```bash
# Убедитесь, что вы авторизованы
supabase login

# Привяжите проект (если еще не привязан)
supabase link --project-ref zaheofzxbfqabdxdmjtz

# Установите секрет
supabase secrets set GEMINI_API_KEY=ваш_ключ_здесь
```

### Через Supabase Dashboard:

1. Откройте https://supabase.com/dashboard/project/zaheofzxbfqabdxdmjtz
2. Перейдите в **Settings** → **Edge Functions** → **Secrets**
3. Добавьте новый секрет:
   - **Name:** `GEMINI_API_KEY`
   - **Value:** ваш API ключ

## Шаг 3: Деплой Edge Function

```bash
# Деплой функции test_gemini
supabase functions deploy test_gemini --project-ref zaheofzxbfqabdxdmjtz
```

## Шаг 4: Тестирование

### Тест через curl:

```bash
curl -X POST \
  'https://zaheofzxbfqabdxdmjtz.supabase.co/functions/v1/test_gemini' \
  -H 'Authorization: Bearer YOUR_JWT_TOKEN' \
  -H 'Content-Type: application/json' \
  -d '{
    "nl": "Покажи всех пользователей",
    "schema": {
      "users": ["id", "name", "email"]
    },
    "dialect": "postgres"
  }'
```

### Тест через фронтенд:

Используйте API клиент для вызова:
```typescript
const response = await fetch(
  'https://zaheofzxbfqabdxdmjtz.supabase.co/functions/v1/test_gemini',
  {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${jwt}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      nl: 'Покажи всех пользователей',
      schema: schemaJson,
      dialect: 'postgres',
    }),
  }
);
```

## Сравнение с OpenAI

После тестирования можно сравнить:
- **Качество SQL** - правильность запросов
- **Скорость** - время генерации
- **Стоимость** - использование токенов
- **Контекстное окно** - Gemini поддерживает до 1M токенов vs 128K у GPT-4o-mini

## Экономия при переходе на Gemini

- **OpenAI GPT-4o-mini:** ~$0.15/$0.60 за 1M токенов (input/output)
- **Gemini 1.5 Flash:** ~$0.075/$0.30 за 1M токенов (input/output)
- **Экономия:** ~50% на стоимости токенов

## После тестирования

Если качество приемлемое, можно:
1. Добавить параметр выбора провайдера (OpenAI/Gemini) в UI
2. Сделать Gemini основным провайдером
3. Обновить `generate_sql` Edge Function для поддержки обоих провайдеров

