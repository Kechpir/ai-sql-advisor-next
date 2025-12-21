# 📋 План реорганизации структуры проекта

## 🎯 Цель
Сделать структуру проекта логичной, понятной и масштабируемой.

## 📁 Предлагаемая структура

```
ai-sql-advisor-next/
├── components/
│   ├── auth/                    # Компоненты авторизации
│   │   ├── OAuthHashHandler.tsx
│   │   └── ForceGoogleLogin.tsx
│   ├── connections/             # Компоненты подключения к БД
│   │   ├── DbConnect.tsx
│   │   └── SimpleDbConnect.tsx
│   ├── tables/                  # Компоненты таблиц и модалок
│   │   ├── DataTable.tsx
│   │   ├── DataTableModal.tsx
│   │   └── TableTabsBar.tsx
│   ├── sql/                     # SQL-связанные компоненты
│   │   ├── SqlDialectSelect.tsx
│   │   └── SqlResult.tsx
│   ├── common/                  # Общие компоненты
│   │   ├── FileUpload.tsx
│   │   └── SchemasManager.tsx
│   ├── layout/                  # Компоненты макета
│   │   ├── AppLayout.tsx
│   │   └── SidebarMenu.tsx
│   ├── SqlBuilderPanel/         # ✅ Уже хорошо организовано
│   └── ui/                      # UI компоненты
│       └── Panel.tsx
│
├── lib/
│   ├── api/                     # API клиенты (разбить api.ts)
│   │   ├── generate-sql.ts
│   │   ├── schemas.ts
│   │   └── index.ts
│   ├── db/                      # Утилиты для работы с БД
│   │   └── jsonToSql.ts         # Переместить из utils/
│   ├── supabaseClient.ts
│   └── utils.ts
│
├── pages/
│   ├── api/                     # ✅ Уже хорошо
│   ├── _app.tsx
│   ├── index.tsx                # Ассистент
│   ├── sql-interface.tsx        # Конструктор
│   ├── auth.tsx
│   ├── reset.tsx
│   └── builder.tsx              # Обертка для SqlBuilderApp
│
├── styles/                      # ✅ Переместить из pages/styles/
│   └── main.css
│
├── public/                      # ✅ Уже хорошо
│
├── supabase/                    # ✅ Уже хорошо
│
└── tools/                       # Очистить дубликаты
    ├── make_snapshot.sh
    └── restore_snapshot.sh
```

## ✅ Преимущества новой структуры

1. **Логическая группировка** - компоненты сгруппированы по функциональности
2. **Масштабируемость** - легко добавлять новые компоненты в нужные папки
3. **Понятность** - сразу видно, где что лежит
4. **Стандартность** - стили в `styles/`, не в `pages/styles/`
5. **Чистота** - удалены backup файлы и дубликаты

## ⚠️ Что нужно будет обновить

1. Все импорты в файлах (автоматически через sed/find-replace)
2. tsconfig.json paths (если нужно)
3. Удалить мусорные файлы

## 🚀 Готов начать реорганизацию?
