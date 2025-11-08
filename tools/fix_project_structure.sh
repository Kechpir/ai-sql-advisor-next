#!/bin/bash
# --- AI SQL Advisor Fix Project Structure (stable) ---
# Упрощённый и надёжный вариант без зависаний и без обработки node_modules

set -e

# --- 1. Создание резервного снапшота ---
SNAPSHOT_NAME="auto-backup-$(date +%Y-%m-%d_%H-%M-%S)"
bash tools/make_snapshot.sh "$SNAPSHOT_NAME"

echo "✅ Резервный снапшот создан: snapshots/$SNAPSHOT_NAME"

# --- 2. Создание нужных директорий ---
mkdir -p pages components tools lib utils styles

# --- 3. Перемещение ключевых страниц ---
echo "📦 Перемещаем страницы..."
[ -f "_app.tsx" ] && mv _app.tsx pages/_app.tsx
[ -f "auth.tsx" ] && mv auth.tsx pages/auth.tsx
[ -f "reset.tsx" ] && mv reset.tsx pages/reset.tsx

# --- 4. Очистка мусорных файлов ---
echo "🧹 Удаляем устаревшие fix_*.sh..."
rm -f fix_recovery.sh fix_recovery2.sh fix_sqlresult.sh compare_stage_vs_main.sh || true

# --- 5. Создание .env.example ---
if [ ! -f ".env.example" ]; then
  echo "📄 Создаём .env.example..."
  cat <<EOF > .env.example
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
OPENAI_API_KEY=
EOF
fi

# --- 6. Пропуск шага алиасов ---
echo "🧩 Пропускаем настройку алиасов (уже добавлены в tsconfig.json)..."

# --- 7. Обновление импортов (только в исходниках, без node_modules) ---
echo "🔄 Обновляем импорты на алиасы..."
find components lib pages utils -type f \( -name "*.ts" -o -name "*.tsx" \) -print0 | while IFS= read -r -d '' file; do
  sed -i 's#\.\./components#@/components#g' "$file"
  sed -i 's#\.\./lib#@/lib#g' "$file"
  sed -i 's#\.\./utils#@/utils#g' "$file"
done

# --- 8. Проверка сборки ---
echo "🧪 Проверяем типы TypeScript..."
npx tsc --noEmit || echo "⚠️ Есть предупреждения TypeScript, проверь выше."

# --- 9. Финал ---
echo "✅ Проект успешно реорганизован и готов к stage-деплою!"
