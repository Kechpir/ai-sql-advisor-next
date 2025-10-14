

---

## 🧠 AI SQL Advisor

> 💬 Умный AI-помощник для написания SQL-запросов.
> Подключается к любой базе данных в режиме read-only, читает структуру таблиц
> и генерирует безопасные SQL-запросы на основе естественного языка.

---

### 🚀 Что делает

* Подключается к **любой SQL-базе** (PostgreSQL, MySQL и др.)
* Считывает структуру таблиц (`fetch_schema`)
* Генерирует корректные SQL-запросы на основе этой структуры (`generate_sql`)
* Гарантирует **read-only безопасность** (блокирует DROP/DELETE/ALTER/и т.д.)
* Работает полностью в **облаке** (Supabase + OpenAI + Neon)

---

### 🧩 Архитектура

```
[Пользователь]
   ↓
[Streamlit или DBeaver Plugin]
   ↓
[Supabase Edge Functions]
   ├── fetch_schema → считывает структуру таблиц
   └── generate_sql → генерирует SQL через OpenAI
   ↓
[Внешняя SQL база (PostgreSQL / MySQL)]
   ↓
[OpenAI API]
```

---

### ⚙️ Технологии

| Компонент        | Инструмент                                                    |
| ---------------- | ------------------------------------------------------------- |
| Хостинг функций  | Supabase Edge Functions                                       |
| Язык backend     | Deno (TypeScript)                                             |
| Хранилище данных | Neon.tech (PostgreSQL)                                        |
| AI-мозг          | OpenAI API (GPT-4o)                                           |
| Интерфейс        | Streamlit (веб-панель)                                        |
| Репозиторий      | [GitHub — Kechpir](https://github.com/Kechpir/ai-sql-advisor) |

---

### 🧱 Установка (локально)

```bash
# клонируем репозиторий
git clone https://github.com/Kechpir/ai-sql-advisor.git
cd ai-sql-advisor

# установка Supabase CLI (если нет)
npm install -g supabase

# логин
supabase login

# привязка к проекту
supabase link --project-ref zpppzzwaoplfeoiynkam
```

---

### 🧩 Деплой функций

```bash
# деплой AI-генератора
supabase functions deploy generate_sql

# деплой функции чтения схемы
supabase functions deploy fetch_schema
```

---

### 🧪 Пример вызова API

**POST** `/functions/v1/generate_sql`

```json
{
  "nl": "Покажи имена и email всех клиентов, сделавших заказ за последние 7 дней",
  "schema": { "...": "JSON, возвращённый функцией fetch_schema" }
}
```

**Response:**

```json
{
  "sql": "SELECT c.name, c.email FROM customers c JOIN orders o ON c.id = o.customer_id WHERE o.created_at > NOW() - INTERVAL '7 days';",
  "blocked": false
}
```

---

### 💰 Монетизация (в планах)

* Подписка $20/мес:
  $10 — OpenAI токены, $10 — прибыль
* Авторизация через Supabase Auth
* Оплата Stripe / PayPal
* Тарифы: Free / Pro / Team

---

### 🔒 Безопасность

* Только **read-only подключение**
* SQL никогда не выполняется автоматически
* Блокируются опасные операторы (DROP, DELETE, ALTER и т.д.)
* Пароли не сохраняются, используются только в момент запроса

---

### 🧭 Дорожная карта

| Этап                      | Статус       |
| ------------------------- | ------------ |
| ✅ Подключение Neon DB     | готово       |
| ✅ Supabase Edge Functions | готово       |
| ✅ Интеграция OpenAI       | готово       |
| 🚧 Streamlit UI           | в разработке |
| 🔜 Авторизация и биллинг  | планируется  |

---

### ✨ Автор

**Kechpir** — QA-инженер и разработчик, создающий AI-инструменты для автоматизации работы с базами данных.
Проект создан в 2025 году.

---

Когда вставишь и сохранишь этот файл, сделай:

```powershell
git add README.md
git commit -m "Added project README"
git push
```

---
