param(
  [string]$RootUser = "zealadmin",
  [string]$RootPassword = "ZealMinio@2026",
  [string]$Bucket = "tutor-images",
  [int]$ApiPort = 9000
)

$ErrorActionPreference = "Stop"

$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$backendDir = Resolve-Path (Join-Path $scriptDir "..")
$toolsDir = Join-Path $backendDir "tools\minio"
$mcExe = Join-Path $toolsDir "mc-local.exe"
$mcUrl = "https://dl.min.io/client/mc/release/windows-amd64/mc.exe"

New-Item -ItemType Directory -Force -Path $toolsDir | Out-Null

if (-not (Test-Path $mcExe)) {
  Write-Host "Downloading mc-local.exe..."
  Invoke-WebRequest -Uri $mcUrl -OutFile $mcExe
}

$endpoint = "http://127.0.0.1:$ApiPort"

& $mcExe alias set local $endpoint $RootUser $RootPassword | Out-Null
& $mcExe mb "local/$Bucket" --ignore-existing | Out-Null
& $mcExe anonymous set download "local/$Bucket" | Out-Null

Write-Host "Bucket configured: $Bucket"
Write-Host "Public read policy enabled."
