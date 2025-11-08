#!/bin/bash
# --- AI SQL Advisor Snapshot Script ---
# Использование: ./tools/make_snapshot.sh stable-stage-2025-11-01

set -e

SNAPSHOT_NAME=${1:-"snapshot-$(date +%Y-%m-%d_%H-%M-%S)"}
SNAPSHOT_DIR="snapshots/$SNAPSHOT_NAME"

echo "🧠 Создаём снапшот: $SNAPSHOT_DIR"

# Создаём папку
mkdir -p "$SNAPSHOT_DIR"

# Копируем ключевые директории и файлы (без node_modules, .git, .next и т.д.)
echo "📦 Копируем файлы и директории..."
for path in components lib pages styles supabase package.json tsconfig.json next-env.d.ts README.md; do
  if [ -e "$path" ]; then
    echo "➡️  Копирую $path..."
    cp -r "$path" "$SNAPSHOT_DIR/" 2>/dev/null || true
  fi
done

echo "✅ Снапшот успешно создан: $SNAPSHOT_DIR"
echo "💾 Чтобы восстановить: cp -r $SNAPSHOT_DIR/* ./"
