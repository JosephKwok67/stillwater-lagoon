param(
  [string]$Tag = "manual"
)

$ErrorActionPreference = "Stop"
$ProjectRoot = Split-Path -Parent $PSScriptRoot
$BackupRoot = Join-Path $ProjectRoot "backups"
New-Item -ItemType Directory -Force -Path $BackupRoot | Out-Null

$Timestamp = Get-Date -Format "yyyy-MM-dd_HHmmss"
$SafeTag = ($Tag -replace '[^a-zA-Z0-9_\-\.]', '_')
$ArchiveName = "backup_${Timestamp}_${SafeTag}.zip"
$ArchivePath = Join-Path $BackupRoot $ArchiveName

# Collect clean source, config, docs, brief, and lightweight game assets (exclude heavy node_modules/dist/references/backups)
$IncludeNames = @(
  "src",
  "docs",
  "scripts",
  "art_pipeline",
  "public",
  "index.html",
  "package.json",
  "package-lock.json",
  "vite.config.js",
  "ASSETS_ANIMATIONS.md",
  ".gitignore"
)

$TempStage = Join-Path ([IO.Path]::GetTempPath()) ("fishing_backup_" + [Guid]::NewGuid().ToString("N"))
New-Item -ItemType Directory -Force -Path $TempStage | Out-Null

try {
  foreach ($name in $IncludeNames) {
    $srcPath = Join-Path $ProjectRoot $name
    if (Test-Path $srcPath) {
      Copy-Item -LiteralPath $srcPath -Destination $TempStage -Recurse -Force
    }
  }

  Compress-Archive -Path (Join-Path $TempStage "*") -DestinationPath $ArchivePath -CompressionLevel Optimal -Force
} finally {
  Remove-Item -LiteralPath $TempStage -Recurse -Force -ErrorAction SilentlyContinue
}

$SizeKB = [Math]::Round((Get-Item $ArchivePath).Length / 1KB, 1)
$LogPath = Join-Path $BackupRoot "BACKUP_LOG.md"
if (-not (Test-Path $LogPath)) {
  Set-Content -Path $LogPath -Encoding UTF8 -Value "# 源码快照备份日志`r`n`r`n| 时间 | 归档文件名 | 标记 | 体积 (KB) |`r`n|---|---|---|---|"
}
$NowStr = Get-Date -Format "yyyy-MM-dd HH:mm:ss"
Add-Content -Path $LogPath -Encoding UTF8 -Value "| $NowStr | ``$ArchiveName`` | $Tag | ${SizeKB} KB |"

Write-Output "Backup created: $ArchivePath (${SizeKB} KB)"
