#!/bin/bash
echo "🔍 Сравнение веток: main 🆚 stage"
echo "--------------------------------------"
git fetch origin main stage --quiet

FILES=(
  "package.json"
  "next.config.js"
  "jsconfig.json"
  "tsconfig.json"
  "pages/api/google-login.ts"
  "pages/index.tsx"
  "components/DbConnect.tsx"
  "components/SchemasManager.tsx"
  "lib/api.ts"
)

for FILE in "${FILES[@]}"; do
  if git ls-tree -r origin/main --name-only | grep -q "^${FILE}$"; then
    echo -e "\n🧩 Проверка файла: $FILE"
    git diff --color=always origin/main -- "$FILE" | sed 's/^/    /'
  else
    echo -e "\n⚠️  Файл отсутствует в main: $FILE"
  fi
done

echo -e "\n✅ Проверка завершена. Красные строки — отличия stage от main."
