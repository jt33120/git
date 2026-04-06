from pydantic_settings import BaseSettings

class Settings(BaseSettings):
    supabase_url: str
    supabase_service_key: str
    openai_api_key: str
    jwt_secret: str = "change-me-in-production"
    frontend_url: str = "https://git-alpha-hazel.vercel.app"

    class Config:
        env_file = ".env"

settings = Settings()
