"""Internal MediStock agent service entrypoint."""

from __future__ import annotations

import logging
from contextlib import asynccontextmanager
from pathlib import Path

from dotenv import load_dotenv

_current_dir = Path(__file__).resolve().parent
load_dotenv(_current_dir.parent.parent / ".env")
load_dotenv(_current_dir.parent.parent.parent / ".env")
load_dotenv()

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from medistock_agents.api.demand_routes import demand_router
from medistock_agents.api.routes import (
    inventory_router,
    procurement_router,
    router,
)

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
)
logger = logging.getLogger("medistock_agents")


@asynccontextmanager
async def lifespan(app: FastAPI):
    logger.info("Initializing MediStock Agentic AI Service (LangGraph)...")
    logger.info("Service bound internally for ASP.NET Core AgentGateway.")
    yield
    logger.info("Shutting down MediStock Agentic AI Service...")


app = FastAPI(
    title="MediStock Agentic AI Service",
    description="Internal LangGraph service for redistribution, inventory, procurement, and demand planning.",
    version="1.0.0",
    lifespan=lifespan,
    docs_url="/docs",
    redoc_url="/redoc",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5000",
        "http://127.0.0.1:5000",
        "http://localhost:5173",
        "http://127.0.0.1:5173",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(router)
app.include_router(inventory_router)
app.include_router(procurement_router)
app.include_router(demand_router)

if __name__ == "__main__":
    import uvicorn

    uvicorn.run("medistock_agents.main:app", host="127.0.0.1", port=8000, reload=False)
