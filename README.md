# Zeal Catalyst

## Local MinIO setup (Windows, no Docker)

Run these from project root in PowerShell:

```powershell
cd backend
powershell -ExecutionPolicy Bypass -File .\scripts\configure_backend_env_minio.ps1
powershell -ExecutionPolicy Bypass -File .\scripts\start_minio_local.ps1
powershell -ExecutionPolicy Bypass -File .\scripts\setup_minio_bucket.ps1
```

MinIO URLs:
- API: `http://127.0.0.1:9000`
- Console: `http://127.0.0.1:9001`

Then start backend:

```powershell
cd backend
.\.venv\Scripts\python.exe -m uvicorn app.main:app --host 127.0.0.1 --port 8000 --reload
```

To stop local MinIO:

```powershell
cd backend
powershell -ExecutionPolicy Bypass -File .\scripts\stop_minio_local.ps1
```
