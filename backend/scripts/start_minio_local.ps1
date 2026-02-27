param(
  [string]$RootUser = "zealadmin",
  [string]$RootPassword = "ZealMinio@2026",
  [int]$ApiPort = 9000,
  [int]$ConsolePort = 9001
)

$ErrorActionPreference = "Stop"

$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$backendDir = Resolve-Path (Join-Path $scriptDir "..")
$toolsDir = Join-Path $backendDir "tools\minio"
$minioExe = Join-Path $toolsDir "minio-local.exe"
$dataDir = Join-Path $backendDir ".minio-data"
$minioUrl = "https://dl.min.io/server/minio/release/windows-amd64/minio.exe"

New-Item -ItemType Directory -Force -Path $toolsDir | Out-Null
New-Item -ItemType Directory -Force -Path $dataDir | Out-Null

if (-not (Test-Path $minioExe)) {
  Write-Host "Downloading minio-local.exe..."
  Invoke-WebRequest -Uri $minioUrl -OutFile $minioExe
}

$existing = Get-CimInstance Win32_Process | Where-Object {
  $_.Name -eq "minio.exe" -and $_.CommandLine -match [regex]::Escape($dataDir)
}
if ($existing) {
  Write-Host "MinIO already running (PID: $($existing.ProcessId))"
  exit 0
}

$env:MINIO_ROOT_USER = $RootUser
$env:MINIO_ROOT_PASSWORD = $RootPassword

$args = @(
  "server"
  "`"$dataDir`""
  "--address", "127.0.0.1:$ApiPort"
  "--console-address", "127.0.0.1:$ConsolePort"
)

Write-Host "Starting MinIO on 127.0.0.1:$ApiPort (console $ConsolePort)..."
Start-Process -FilePath $minioExe -ArgumentList $args -WindowStyle Hidden | Out-Null

Start-Sleep -Seconds 3

$listening = netstat -ano | Select-String ":$ApiPort\s+.*LISTENING"
if (-not $listening) {
  Write-Error "MinIO did not start. Check if another process already uses ports $ApiPort/$ConsolePort."
}

Write-Host "MinIO started."
Write-Host "API:     http://127.0.0.1:$ApiPort"
Write-Host "Console: http://127.0.0.1:$ConsolePort"
Write-Host "User:    $RootUser"
