from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api import dev_config, emotion, location, realtime, tools
from app.settings import get_settings


def create_app() -> FastAPI:
    settings = get_settings()
    app = FastAPI(title="Meadow Agent 麦豆 API", version="0.1.0")

    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.cors_origin_list(),
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    @app.get("/api/health")
    async def health() -> dict:
        return {"status": "ok", "service": "meadow-agent", "name_cn": "麦豆"}

    app.include_router(realtime.router)
    app.include_router(tools.router)
    app.include_router(emotion.router)
    app.include_router(dev_config.router)
    app.include_router(location.router)
    return app


app = create_app()
