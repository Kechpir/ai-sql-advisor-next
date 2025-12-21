# PowerShell скрипт для создания снапшота
param(
    [string]$SnapshotName = ""
)

if ($SnapshotName -eq "") {
    $date = Get-Date -Format "yyyy-MM-dd_HH-mm-ss"
    $SnapshotName = "stable-$date"
}

$SnapshotDir = "snapshots\$SnapshotName"

Write-Host "🧠 Создаём снапшот: $SnapshotDir"

# Создаём папку
New-Item -ItemType Directory -Path $SnapshotDir -Force | Out-Null

# Копируем ключевые директории и файлы
Write-Host "📦 Копируем файлы и директории..."

$paths = @("components", "lib", "pages", "styles", "supabase", "docs", "package.json", "tsconfig.json", "next-env.d.ts", "README.md", "jsconfig.json", "postcss.config.js", "global.d.ts")

foreach ($path in $paths) {
    if (Test-Path $path) {
        Write-Host "➡️  Копирую $path..."
        Copy-Item -Path $path -Destination $SnapshotDir -Recurse -Force -ErrorAction SilentlyContinue
    }
}

Write-Host "✅ Снапшот успешно создан: $SnapshotDir"
Write-Host "💾 Чтобы восстановить: Copy-Item -Path `"$SnapshotDir\*`" -Destination `".\`" -Recurse -Force"
