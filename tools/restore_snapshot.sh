#!/bin/bash
set -e
SNAPSHOT_NAME=${1:-""}
if [ -z "$SNAPSHOT_NAME" ]; then
  echo "❌ Укажи имя снапшота. Пример:"
  echo "./tools/restore_snapshot.sh stable-stage-2025-11-01"
  exit 1
fi

SNAPSHOT_DIR="snapshots/$SNAPSHOT_NAME"

if [ ! -d "$SNAPSHOT_DIR" ]; then
  echo "❌ Снапшот не найден: $SNAPSHOT_DIR"
  exit 1
fi

echo "🧩 Восстанавливаем фронт из снапшота: $SNAPSHOT_DIR"
rsync -a "$SNAPSHOT_DIR/" ./
echo "✅ Откат завершён!"
