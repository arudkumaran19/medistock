@echo off
setlocal
cd /d "%~dp0agent-service"

echo ===================================================
echo     MediStock AI Agent Service Starter
echo ===================================================

netstat -ano | findstr /R /C:":8000 .*LISTENING" >nul 2>&1
if not errorlevel 1 (
    echo [INFO] MediStock Agent Service is ALREADY RUNNING and listening on http://127.0.0.1:8000.
    echo [INFO] Health URL: http://127.0.0.1:8000/health
    echo [INFO] Docs URL:   http://127.0.0.1:8000/docs
    echo To restart, close the existing process holding port 8000 first.
    exit /b 0
)

if not exist ".venv\Scripts\python.exe" (
    echo [ERROR] Virtual environment not found at agent-service\.venv.
    echo Please create it with: python -m venv .venv
    exit /b 1
)

echo Starting MediStock Agent Service on http://127.0.0.1:8000 ...
".venv\Scripts\python.exe" -m uvicorn medistock_agents.main:app --host 127.0.0.1 --port 8000 --reload
