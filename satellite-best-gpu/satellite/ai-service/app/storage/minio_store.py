from __future__ import annotations

import io
from functools import lru_cache

from minio import Minio

from app.config import settings
from app.utils.errors import AppError


@lru_cache(maxsize=1)
def minio_client() -> Minio:
    if not settings.minio_endpoint or not settings.minio_access_key or not settings.minio_secret_key:
        raise AppError(503, "STORAGE_ERROR", "MinIO is not configured on the AI service.")
    endpoint = settings.minio_endpoint.replace("http://", "").replace("https://", "")
    secure = settings.minio_endpoint.startswith("https://")
    return Minio(endpoint, access_key=settings.minio_access_key, secret_key=settings.minio_secret_key, secure=secure)


def download_object(object_key: str) -> bytes:
    try:
        response = minio_client().get_object(settings.minio_bucket, object_key)
        try:
            return response.read()
        finally:
            response.close()
            response.release_conn()
    except AppError:
        raise
    except Exception as ex:
        raise AppError(502, "STORAGE_ERROR", f"Failed to read object '{object_key}': {ex}") from ex


def upload_object(object_key: str, data: bytes, content_type: str) -> None:
    try:
        minio_client().put_object(
            settings.minio_bucket,
            object_key,
            io.BytesIO(data),
            length=len(data),
            content_type=content_type,
        )
    except AppError:
        raise
    except Exception as ex:
        raise AppError(502, "STORAGE_ERROR", f"Failed to write object '{object_key}': {ex}") from ex


download_object = download_object
upload_object = upload_object



