from __future__ import annotations

import importlib
import platform
from typing import Any

from pydantic import BaseModel

from app.config import settings
from app.vlm.registry import vlm_registry


class HealthResponse(BaseModel):
    status: str
    service: str = "ai-service"
    pythonVersion: str
    rasterioAvailable: bool
    gdalAvailable: bool
    gdalVersion: str | None = None
    gpuAvailable: bool
    modelLoaded: bool
    model: str
    vlmDevice: str


def _probe_import(module_name: str) -> tuple[bool, Any | None]:
    try:
        return True, importlib.import_module(module_name)
    except Exception:
        return False, None


def build_health() -> HealthResponse:
    rasterio_ok, rasterio = _probe_import("rasterio")
    gdal_version = None
    gdal_ok = False
    if rasterio_ok and rasterio is not None:
        gdal_version = getattr(rasterio, "__gdal_version__", None)
        gdal_ok = gdal_version is not None
    if not gdal_ok:
        osgeo_ok, osgeo_gdal = _probe_import("osgeo.gdal")
        if osgeo_ok and osgeo_gdal is not None:
            gdal_ok = True
            gdal_version = getattr(osgeo_gdal, "__version__", None)

    gpu_available = False
    torch_ok, torch = _probe_import("torch")
    if torch_ok and torch is not None:
        try:
            gpu_available = bool(torch.cuda.is_available())
        except Exception:
            gpu_available = False

    return HealthResponse(
        status="UP",
        pythonVersion=platform.python_version(),
        rasterioAvailable=rasterio_ok,
        gdalAvailable=gdal_ok,
        gdalVersion=gdal_version,
        gpuAvailable=gpu_available,
        modelLoaded=vlm_registry.is_loaded(),
        model=settings.vlm_model_name,
        vlmDevice=settings.vlm_device,
    )
