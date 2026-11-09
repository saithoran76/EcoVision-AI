from pydantic_settings import BaseSettings, SettingsConfigDict

class Settings(BaseSettings):
    app_name: str = "EcoVision AI"
    environment: str = "development"
    secret_key: str = "replace-with-a-long-random-secret"
    mongo_uri: str | None = None
    mongo_db: str = "ecovision"
    gemini_api_key: str | None = None
    gemini_model: str = "gemini-2.5-flash"
    upload_dir: str = "uploads"
    max_upload_mb: int = 10
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

settings = Settings()
