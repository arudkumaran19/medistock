from pathlib import Path
from dotenv import load_dotenv

# Ensure environment variables are loaded from agent-service/.env and repository .env
_current_dir = Path(__file__).resolve().parent
load_dotenv(_current_dir.parent.parent / ".env")
load_dotenv(_current_dir.parent.parent.parent / ".env")
load_dotenv()

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from medistock_agents.api.routes import router, procurement_router


app = FastAPI(
    title="MediStock Intelligence Agents",
    description="Inventory & Procurement Policy Validation agents for MediStock.",
    version="1.0.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://127.0.0.1:5173",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(router)
app.include_router(procurement_router)


@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok"}