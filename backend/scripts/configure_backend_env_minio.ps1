$ErrorActionPreference = "Stop"

$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$backendDir = Resolve-Path (Join-Path $scriptDir "..")
$envFile = Join-Path $backendDir ".env"

if (-not (Test-Path $envFile)) {
  throw ".env not found at $envFile"
}

$content = Get-Content $envFile -Raw

$replacements = @{
  "MINIO_ENDPOINT=.*"   = "MINIO_ENDPOINT=127.0.0.1:9000"
  "MINIO_ACCESS_KEY=.*" = "MINIO_ACCESS_KEY=zealadmin"
  "MINIO_SECRET_KEY=.*" = "MINIO_SECRET_KEY=ZealMinio@2026"
  "MINIO_SECURE=.*"     = "MINIO_SECURE=false"
  "MINIO_BUCKET=.*"     = "MINIO_BUCKET=tutor-images"
  "MINIO_PUBLIC_URL=.*" = "MINIO_PUBLIC_URL=http://127.0.0.1:9000"
}

foreach ($pattern in $replacements.Keys) {
  if ($content -match $pattern) {
    $content = [regex]::Replace($content, $pattern, $replacements[$pattern])
  } else {
    $content += "`r`n$($replacements[$pattern])"
  }
}

Set-Content -Path $envFile -Value $content -NoNewline

Write-Host "Updated MinIO keys in backend/.env"
