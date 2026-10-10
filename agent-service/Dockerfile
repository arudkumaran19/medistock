FROM python:3.11-slim

WORKDIR /app
ENV PYTHONPATH=/app/src

# Copy requirements and install dependencies
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy source code
COPY . .

EXPOSE 8000

CMD ["uvicorn", "src.medistock_agents.main:app", "--host", "0.0.0.0", "--port", "8000"]
