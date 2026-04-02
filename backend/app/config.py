from pydantic_settings import BaseSettings
from typing import Optional

class Settings(BaseSettings):
    DATABASE_URL: str = "postgresql://kiwasco_user:kiwasco_pass@localhost:5432/kiwasco_db"
    SECRET_KEY: str = "kiwasco-super-secret-jwt-key-change-in-production-2024"
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60 * 24  # 24 hours

    class Config:
        env_file = ".env"
        extra = "allow"

settings = Settings()
