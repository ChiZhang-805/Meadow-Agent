from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=(".env", "../.env"),
        env_file_encoding="utf-8",
        extra="ignore",
    )

    app_env: str = "development"
    app_origin: str = "http://localhost:5173"
    cors_allowed_origins: str = ""
    demo_user_id: str = "demo-user"

    openai_api_key: str = ""
    openai_realtime_model: str = "gpt-realtime-2"
    openai_realtime_voice: str = "marin"
    run_openai_live_tests: bool = False
    amap_api_key: str = ""

    database_url: str = "postgresql+asyncpg://elderly:elderly_pass@localhost:5432/elderly_ai"
    redis_url: str = "redis://localhost:6379/0"

    grocery_provider: str = "mock"
    single_order_limit_cents: int = 5000
    daily_budget_cents: int = 10000
    confirmation_token_ttl_seconds: int = 300

    def cors_origin_list(self) -> list[str]:
        origins = [
            self.app_origin,
            "http://localhost:5173",
            "http://127.0.0.1:5173",
        ]
        origins.extend(origin.strip() for origin in self.cors_allowed_origins.split(",") if origin.strip())
        return list(dict.fromkeys(origin for origin in origins if origin))


@lru_cache
def get_settings() -> Settings:
    return Settings()
