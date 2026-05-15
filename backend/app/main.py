import logging
import sys

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s %(levelname)s %(name)s: %(message)s",
    stream=sys.stdout,
    force=True,
)

from contextlib import asynccontextmanager
import asyncio

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.routes import health, accounts, transactions, recommendations, contagion, timemachine
from app.config import settings
from app.services.engine_state import warm_up, state


@asynccontextmanager
async def lifespan(app: FastAPI):
    logging.getLogger("startup").info("Lifespan begin — scheduling warm_up in background")
    loop = asyncio.get_event_loop()
    loop.create_task(asyncio.to_thread(warm_up, False))
    yield
    logging.getLogger("startup").info("Lifespan end")


app = FastAPI(
    title=settings.app_name,
    version=settings.app_version,
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(health.router, tags=["health"])
app.include_router(accounts.router, prefix="/accounts", tags=["accounts"])
app.include_router(transactions.router, prefix="/transactions", tags=["transactions"])
app.include_router(recommendations.router, prefix="/recommendations", tags=["recommendations"])
app.include_router(contagion.router, prefix="/contagion", tags=["contagion"])
app.include_router(timemachine.router, prefix="/timemachine", tags=["timemachine"])


@app.get("/version")
def get_version():
    return {"version": settings.app_version}
