$ErrorActionPreference = "Stop"

$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$backendDir = Resolve-Path (Join-Path $scriptDir "..")
$dataDir = Join-Path $backendDir ".minio-data"

$targets = Get-CimInstance Win32_Process | Where-Object {
  $_.Name -eq "minio.exe" -and $_.CommandLine -match [regex]::Escape($dataDir)
}

if (-not $targets) {
  Write-Host "No local project MinIO process found."
  exit 0
}

foreach ($p in $targets) {
  Stop-Process -Id $p.ProcessId -Force
  Write-Host "Stopped MinIO PID $($p.ProcessId)"
}
