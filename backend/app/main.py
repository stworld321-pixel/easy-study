from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager
from app.core.config import settings
from app.core.database import connect_to_mongo, close_mongo_connection
from app.routes import api_router
import traceback

@asynccontextmanager
async def lifespan(app: FastAPI):
    if settings.SECRET_KEY == "change-me-in-env":
        print("WARNING: SECRET_KEY is using the default value. Set a strong SECRET_KEY in environment variables.")
    try:
        await connect_to_mongo()
        print("Database connected successfully")
    except Exception as e:
        print(f"Failed to connect to database: {e}")
        traceback.print_exc()
    yield
    await close_mongo_connection()

app = FastAPI(
    title=settings.APP_NAME,
    version="1.0.0",
    lifespan=lifespan
)

# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include API routes
app.include_router(api_router, prefix="/api")

@app.get("/")
async def root():
    return {
        "message": "Welcome to Zeal Catalyst Tutoring Platform API",
        "version": "1.0.0",
        "docs": "/docs"
    }

@app.get("/health")
async def health_check():
    return {"status": "healthy"}

@app.get("/api/debug/status")
async def debug_status():
    """Debug endpoint to check service status"""
    from app.core.database import client
    status = {
        "app": "running",
        "database": "unknown",
        "config": {
            "database_name": settings.DATABASE_NAME,
            "minio_endpoint": settings.MINIO_ENDPOINT,
        }
    }
    try:
        if client:
            await client.admin.command('ping')
            status["database"] = "connected"
        else:
            status["database"] = "not initialized"
    except Exception as e:
        status["database"] = f"error: {str(e)}"
    return status
