# Agentic AI service image for cloud deployment (Render web service, Docker runtime).
# Build context: the agent-service/ folder.
#
# Configuration comes only from environment variables set on the host:
#   MEDISTOCK_API_BASE_URL, AGENT_SERVICE_TOKEN, GEMINI_API_KEY, GEMINI_MODEL,
#   CORS_ALLOWED_ORIGINS.
# No .env file is copied into the image.

FROM python:3.11-slim

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PYTHONPATH=/app/src

WORKDIR /app

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY src/ src/

EXPOSE 8000

# Render supplies the port in $PORT; 8000 is the local default.
CMD ["sh", "-c", "uvicorn medistock_agents.main:app --host 0.0.0.0 --port ${PORT:-8000}"]
