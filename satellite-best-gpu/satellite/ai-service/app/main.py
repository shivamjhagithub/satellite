import logging

from fastapi import FastAPI, Request
from fastapi.responses import JSONResponse

from app.api.health import router as health_router
from app.api.pipeline import router as pipeline_router
from app.utils.correlation import CorrelationIdMiddleware
from app.utils.errors import AppError
from app.vlm.registry import vlm_registry

log = logging.getLogger(__name__)

app = FastAPI(
    title="Satellite AI Geospatial Service",
    description="Raster processing and VLM inference for the satellite AI platform.",
    version="0.2.0",
)

app.add_middleware(CorrelationIdMiddleware)
app.include_router(health_router)
app.include_router(pipeline_router)


@app.on_event("startup")
def _warm_up_vlm() -> None:
    try:
        vlm_registry.load()
    except Exception:
        log.exception("VLM warm-up failed at startup; will retry on first request")


@app.exception_handler(AppError)
async def app_error_handler(_request: Request, exc: AppError):
    if exc.status_code >= 500:
        log.error("AppError %s: %s", exc.error_code, exc.message, exc_info=exc.__cause__)
    return JSONResponse(
        status_code=exc.status_code,
        content={"errorCode": exc.error_code, "message": exc.message},
    )