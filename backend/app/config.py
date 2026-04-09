from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    """Application settings loaded from environment variables."""

    # Supabase
    supabase_url: str = ""
    supabase_service_role_key: str = ""
    supabase_jwt_secret: str = ""
    supabase_db_url: str = ""  # postgresql+asyncpg://...

    # Google OAuth
    google_client_id: str = ""
    google_client_secret: str = ""

    # OpenRouter LLM
    openrouter_api_key: str = ""
    openrouter_model: str = "meta-llama/llama-3.1-8b-instruct:free"
    openrouter_embedding_model: str = "meta-llama/llama-3.1-8b-instruct:free"

    # App
    cors_origins: str = "*"
    debug: bool = False

    model_config = {"env_file": ".env", "env_file_encoding": "utf-8"}


settings = Settings()
