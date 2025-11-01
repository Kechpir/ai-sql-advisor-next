#!/bin/bash
# --- AI SQL Advisor Snapshot Script ---
# Использование: ./tools/make_snapshot.sh stable-stage-2025-11-01

set -e

SNAPSHOT_NAME=${1:-"snapshot-$(date +%Y-%m-%d_%H-%M-%S)"}
SNAPSHOT_DIR="snapshots/$SNAPSHOT_NAME"

echo "🧠 Создаём снапшот: $SNAPSHOT_DIR"

# Создаём папку
mkdir -p "$SNAPSHOT_DIR"

# Копируем ключевые директории и файлы
rsync -a \
  --exclude 'node_modules' \
  --exclude '.next' \
  --exclude '.git' \
  --exclude 'out' \
  --exclude 'snapshots' \
  components lib pages styles supabase package.json tsconfig.json next-env.d.ts README.md "$SNAPSHOT_DIR/"

echo "✅ Снапшот успешно создан: $SNAPSHOT_DIR"
