from fastapi import APIRouter
from app.services.engine_state import state

router = APIRouter()


@router.get("/health")
def health():
    return {
        "status": "ok",
        "engine_ready": state.ready,
        "warmed_at": state.warmed_at.isoformat() if state.warmed_at else None,
        "error": state.error,
    }
