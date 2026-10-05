from pathlib import Path
from dotenv import load_dotenv

# Ensure environment variables are loaded from agent-service/.env and repository .env
_current_dir = Path(__file__).resolve().parent
load_dotenv(_current_dir.parent.parent / ".env")
load_dotenv(_current_dir.parent.parent.parent / ".env")
load_dotenv()

import os

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from medistock_agents.api.routes import router, procurement_router
# Demand & Shortage vertical (Sathurstiga S., IT24103156) - own module, so
# api/routes.py is untouched.
from medistock_agents.api.demand_routes import demand_router
# Redistribution vertical (Member 3) - own module, additive.
from medistock_agents.api.redistribution_routes import redistribution_router


app = FastAPI(
    title="MediStock Intelligence Agents",
    description="Inventory & Procurement Policy Validation agents for MediStock.",
    version="1.0.0",
)

LOCAL_WEB_ORIGINS = [
    "http://localhost:5173",
    "http://127.0.0.1:5173",
]

# Deployed web origins, e.g. "https://medistock-web.onrender.com". Comma-separated.
# The local origins above stay allowed exactly as before.
DEPLOYED_WEB_ORIGINS = [
    origin.strip().rstrip("/")
    for origin in os.getenv("CORS_ALLOWED_ORIGINS", "").split(",")
    if origin.strip()
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=LOCAL_WEB_ORIGINS + DEPLOYED_WEB_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(router)
app.include_router(procurement_router)
app.include_router(demand_router)
app.include_router(redistribution_router)


@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok"}