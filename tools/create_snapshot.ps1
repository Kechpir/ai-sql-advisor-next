# Создание актуального снапшота проекта
$date = Get-Date -Format "yyyy-MM-dd_HH-mm-ss"
$snapshotName = "stable-arch-$date"
$snapshotDir = "snapshots\$snapshotName"

Write-Host "🧠 Создаём снапшот: $snapshotDir" -ForegroundColor Cyan

# Создаём папку
New-Item -ItemType Directory -Path $snapshotDir -Force | Out-Null

# Список файлов и папок для копирования
$itemsToCopy = @(
    "components",
    "lib",
    "pages",
    "supabase",
    "package.json",
    "tsconfig.json",
    "next-env.d.ts",
    "README.md",
    "jsconfig.json",
    "postcss.config.js",
    "global.d.ts",
    "utils"
)

# Копируем файлы и папки
foreach ($item in $itemsToCopy) {
    if (Test-Path $item) {
        Copy-Item -Path $item -Destination $snapshotDir -Recurse -Force
        Write-Host "✅ Скопировано: $item" -ForegroundColor Green
    } else {
        Write-Host "⚠️  Пропущено (не найдено): $item" -ForegroundColor Yellow
    }
}

Write-Host ""
Write-Host "✅ Снапшот успешно создан: $snapshotName" -ForegroundColor Green
Write-Host "📁 Путь: $snapshotDir" -ForegroundColor Cyan
