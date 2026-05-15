from fastapi import APIRouter, BackgroundTasks
from app.services.engine_state import state, warm_up

router = APIRouter()


@router.get("/health")
def health():
    return {
        "status": "ok",
        "engine_ready": state.ready,
        "warmed_at": state.warmed_at.isoformat() if state.warmed_at else None,
        "error": state.error,
    }


@router.post("/admin/warmup")
def trigger_warmup(background_tasks: BackgroundTasks):
    """Manual trigger for warm_up — useful for debugging or recovery."""
    background_tasks.add_task(warm_up, False)
    return {"status": "warmup_triggered", "engine_ready_before": state.ready}
