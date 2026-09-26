"""MediStock Agentic AI Service entrypoint.

STRICT ARCHITECTURAL BOUNDARY:
This FastAPI service runs as an INTERNAL microservice.
It is ONLY reachable by the authoritative ASP.NET Core backend via AgentGateway.
Direct access from React management or Flutter mobile clients is forbidden.
"""

from __future__ import annotations

import logging
from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from medistock_agents.api.routes import router

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
)
logger = logging.getLogger("medistock_agents")


@asynccontextmanager
async def lifespan(app: FastAPI):
    logger.info("Initializing MediStock Agentic AI Service (LangGraph)...")
    logger.info("Service bound internally to localhost for ASP.NET Core AgentGateway.")
    yield
    logger.info("Shutting down MediStock Agentic AI Service...")


app = FastAPI(
    title="MediStock Agentic AI Service",
    description="Internal LangGraph microservice for hospital medicine redistribution planning.",
    version="1.0.0",
    lifespan=lifespan,
    docs_url="/docs",
    redoc_url="/redoc",
)

# Internal service communication: only allow internal ASP.NET Core backend loopback
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5000", "http://127.0.0.1:5000"],
    allow_credentials=True,
    allow_methods=["GET", "POST"],
    allow_headers=["*"],
)

app.include_router(router)

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("medistock_agents.main:app", host="127.0.0.1", port=8000, reload=False)
