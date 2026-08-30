from fastapi import APIRouter

from app.services.health_service import build_health

router = APIRouter()


@router.get("/health")
def health():
    return build_health()
