from typing import Optional
from pydantic import AliasChoices, Field, field_validator
from pydantic_settings import BaseSettings

class Settings(BaseSettings):
    APP_NAME: str = "Zeal Catalyst Tutoring Platform"
    DEBUG: bool = False

    # MongoDB
    MONGODB_URL: str = "mongodb://localhost:27017"
    DATABASE_NAME: str = "zealcatalyst"

    # JWT Settings
    SECRET_KEY: str = "change-me-in-env"
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 1440  # 24 hours

    # CORS
    CORS_ORIGINS: str = Field(
        default="http://localhost:3000,http://localhost:5173",
        validation_alias=AliasChoices("CORS_ORIGINS", "ALLOWED_ORIGINS"),
    )

    # Frontend URL for email links
    FRONTEND_URL: str = "https://easystudy.cloud"
    BACKEND_BASE_URL: str = "http://127.0.0.1:8000"

    # Google Calendar/Meet API Settings
    GOOGLE_CLIENT_SECRET_FILE: Optional[str] = None  # Path to OAuth client secret JSON file
    GOOGLE_CLIENT_ID: str = ""  # For OAuth verification (set in .env)
    GOOGLE_CLIENT_SECRET: str = ""  # Google OAuth client secret (set in .env)
    GOOGLE_REDIRECT_URI: Optional[str] = None  # Optional hardcoded OAuth callback URI
    FIREBASE_PROJECT_ID: Optional[str] = None
    FIREBASE_SERVICE_ACCOUNT_FILE: Optional[str] = None
    FIREBASE_SERVICE_ACCOUNT_JSON: Optional[str] = None
    FIREBASE_WEB_API_KEY: Optional[str] = None

    # Email/SMTP Settings
    MAIL_HOST: str = Field(
        default="smtp.hostinger.com",
        validation_alias=AliasChoices("MAIL_HOST", "SMTP_HOST"),
    )
    MAIL_PORT: int = Field(
        default=465,
        validation_alias=AliasChoices("MAIL_PORT", "SMTP_PORT"),
    )
    MAIL_USERNAME: str = Field(
        default="",
        validation_alias=AliasChoices("MAIL_USERNAME", "SMTP_USER"),
    )
    MAIL_PASSWORD: str = Field(
        default="",
        validation_alias=AliasChoices("MAIL_PASSWORD", "SMTP_PASSWORD"),
    )
    MAIL_FROM_ADDRESS: str = Field(
        default="coo@zealcatalyst.com",
        validation_alias=AliasChoices("MAIL_FROM_ADDRESS", "FROM_EMAIL"),
    )
    MAIL_FROM_NAME: str = "Zeal Catalyst"
    MAIL_USE_SSL: Optional[bool] = None  # Auto-detect from port unless explicitly set

    # Razorpay Settings
    RAZORPAY_KEY_ID: str = ""
    RAZORPAY_KEY_SECRET: str = ""

    # MinIO Settings
    MINIO_ENDPOINT: str = "localhost:9000"
    MINIO_ACCESS_KEY: str = "zealadmin"
    MINIO_SECRET_KEY: str = "ZealMinio@2026"
    MINIO_SECURE: bool = False
    MINIO_BUCKET: str = "tutor-images"
    MINIO_PUBLIC_URL: Optional[str] = None  # External URL for accessing images

    # Meeting Provider
    MEETING_PROVIDER: str = "jitsi"  # jitsi | google_meet
    JITSI_DOMAIN: str = "meet.jit.si"
    JITSI_APP_ID: str = ""
    JITSI_APP_SECRET: str = ""
    JITSI_TOKEN_AUDIENCE: str = "jitsi"
    JITSI_TOKEN_ISSUER: str = "zealcatalyst"
    JITSI_TOKEN_TTL_MINUTES: int = 180
    JITSI_REQUIRE_JWT: bool = False

    @field_validator("DEBUG", mode="before")
    @classmethod
    def parse_debug_value(cls, value):
        if isinstance(value, bool):
            return value
        if isinstance(value, str):
            normalized = value.strip().lower()
            if normalized in {"1", "true", "yes", "on", "debug", "development", "dev"}:
                return True
            if normalized in {"0", "false", "no", "off", "release", "production", "prod"}:
                return False
        return value

    @property
    def cors_origins_list(self) -> list[str]:
        return [origin.strip() for origin in self.CORS_ORIGINS.split(",") if origin.strip()]

    class Config:
        env_file = ".env"

settings = Settings()
