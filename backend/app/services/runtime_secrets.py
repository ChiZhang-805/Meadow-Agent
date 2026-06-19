from dataclasses import dataclass
from functools import lru_cache

from app.settings import Settings


@dataclass
class RuntimeSecretStatus:
    name: str
    configured: bool
    source: str
    required_for_mvp: bool


class RuntimeSecrets:
    def __init__(self) -> None:
        self._openai_api_key: str | None = None
        self._amap_api_key: str | None = None

    def set_openai_api_key(self, key: str) -> None:
        self._openai_api_key = key.strip()

    def set_amap_api_key(self, key: str) -> None:
        self._amap_api_key = key.strip()

    def get_openai_api_key(self, settings: Settings) -> str:
        runtime_key = self._openai_api_key or ""
        env_key = settings.openai_api_key or ""
        return runtime_key or env_key

    def get_amap_api_key(self, settings: Settings) -> str:
        runtime_key = self._amap_api_key or ""
        env_key = settings.amap_api_key or ""
        return runtime_key or env_key

    def has_runtime_openai_api_key(self) -> bool:
        return bool(self._openai_api_key)

    def has_runtime_amap_api_key(self) -> bool:
        return bool(self._amap_api_key)


@lru_cache
def get_runtime_secrets() -> RuntimeSecrets:
    return RuntimeSecrets()


def is_configured_secret(value: str | None) -> bool:
    if not value:
        return False
    return not value.startswith("sk-REPLACE")


def build_external_config_status(settings: Settings, runtime_secrets: RuntimeSecrets) -> list[RuntimeSecretStatus]:
    openai_key = runtime_secrets.get_openai_api_key(settings)
    openai_source = "runtime_memory" if runtime_secrets.has_runtime_openai_api_key() else "environment"
    amap_key = runtime_secrets.get_amap_api_key(settings)
    amap_source = "runtime_memory" if runtime_secrets.has_runtime_amap_api_key() else "environment"

    return [
        RuntimeSecretStatus(
            name="OPENAI_API_KEY",
            configured=is_configured_secret(openai_key),
            source=openai_source,
            required_for_mvp=True,
        ),
        RuntimeSecretStatus(
            name="AMAP_API_KEY",
            configured=bool(amap_key),
            source=amap_source,
            required_for_mvp=True,
        ),
        RuntimeSecretStatus(
            name="DATABASE_URL",
            configured=bool(settings.database_url),
            source="environment",
            required_for_mvp=False,
        ),
        RuntimeSecretStatus(
            name="REDIS_URL",
            configured=bool(settings.redis_url),
            source="environment",
            required_for_mvp=False,
        ),
        RuntimeSecretStatus(
            name="GROCERY_PROVIDER_API_KEY",
            configured=False,
            source="not_used",
            required_for_mvp=False,
        ),
    ]
