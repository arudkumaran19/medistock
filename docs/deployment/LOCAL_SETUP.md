# MediStock Local Development Setup & Execution Guide

**Document Version:** 1.0.0  
**Target Environment:** Local Windows / Linux / macOS Development Workstation  
**Authoritative Backend:** ASP.NET Core 8 Web API  
**Database:** PostgreSQL 17 (Docker or Native)  
**Agent Service:** Python 3.11+ / FastAPI / LangGraph  
**Web Frontend:** React 18 / TypeScript / Vite  
**Mobile Application:** Flutter 3.47+ / Dart 3.13+  

---

## 1. System Prerequisites

Before starting MediStock locally, ensure your machine satisfies the following runtime requirements:

| Tool / Runtime | Verified Version | Verification Command | Purpose |
|---|---|---|---|
| **Git** | `2.47+` | `git --version` | Version control & repository tracking |
| **Docker & Docker Compose** | `Docker 29.x+` / `Compose v5.x+` | `docker --version; docker compose version` | Containerized PostgreSQL, backend, agent, and web services |
| **.NET SDK** | `8.0.4xx` (or `10.0.x`) | `dotnet --version` | ASP.NET Core Web API build and test execution |
| **Node.js & npm** | `Node v20+` / `v24+`, `npm 10+` | `node --version; npm --version` | React Web application dependencies and Vite dev server |
| **Python** | `3.11+` / `3.12+` | `python --version` | Agentic AI microservice, LangGraph state graph execution |
| **Flutter SDK** | `3.44+` / `3.47+` | `flutter --version` | Cross-platform mobile application compile and analysis |

---

## 2. Architecture & Port Allocation

When running locally, services communicate across the following ports:

```
[ Browser / User ] ───► http://localhost:5173 (React Web App)
                              │
                              ▼
[ Mobile / App ]   ───► http://localhost:5050 (ASP.NET Core API)
                              │
               ┌──────────────┴──────────────┐
               ▼                             ▼
   http://localhost:5430           http://localhost:8000
    (PostgreSQL 17 DB)            (Python LangGraph Agent)
```

| Service | Host Port | Internal Container Port | Health Check URL | Description |
|---|---|---|---|---|
| **PostgreSQL** | `5430` | `5432` | `pg_isready -U medistock -p 5432` | Relational database (35 tables) |
| **ASP.NET Core API** | `5050` | `5050` | `http://localhost:5050/health` | Central REST API, RBAC & Domain logic |
| **Python Agent Service** | `8000` | `8000` | `http://localhost:8000/health` | 5-agent LangGraph coordinator service |
| **React Web Portal** | `5173` | `80` (prod container) | `http://localhost:5173/` | Vite development server / Web UI |
| **Flutter Mobile** | N/A (Client) | N/A | Targets `http://10.0.2.2:5050` (Emulator) or `http://localhost:5050` | Mobile field logistics client |

---

## 3. Workflow 1: Running with Docker Compose (Recommended)

Docker Compose provides a complete, one-command deployment of PostgreSQL, the ASP.NET Core backend, the Python agent service, and the React web app.

### 3.1 Start All Services
From the repository root:
```powershell
docker compose up -d --build
```

### 3.2 Verify Container Health
```powershell
docker compose ps
```
Expected output:
- `medistock-postgres`: `Up (healthy)`
- `medistock-backend`: `Up (healthy)`
- `medistock-agent-service`: `Up`
- `medistock-web`: `Up`

### 3.3 Safe Shutdown
```powershell
docker compose down
```
> **IMPORTANT:** Never use `docker compose down -v` unless you intentionally want to wipe all local database records.

---

## 4. Workflow 2: Running Services Natively (Multi-Process Local Dev)

For active full-stack development, running services directly on the host machine enables instant hot-reloading across backend, frontend, agent service, and mobile.

### Step 1: Start PostgreSQL in Docker
MediStock maps container port `5432` to host port `5430` to avoid conflicts with any existing local PostgreSQL instances.
```powershell
docker compose up -d postgres
```
Verify readiness:
```powershell
docker exec medistock-postgres pg_isready -U medistock
```

### Step 2: Start the ASP.NET Core Backend
Open Terminal 1:
```powershell
cd backend/src/MediStock.Api
dotnet run --urls "http://localhost:5050"
```
Verify in your browser or terminal:
- Health check: `http://localhost:5050/health` (Returns `{"status":"ok"}`)
- OpenAPI/Swagger: `http://localhost:5050/swagger`

### Step 3: Start the Python Agent Service
Open Terminal 2:
```powershell
cd agent-service
# Activate virtual environment
.\.venv\Scripts\Activate.ps1   # Windows PowerShell
# On macOS/Linux: source .venv/bin/activate

# Set local backend URL
$env:PYTHONPATH="src"
$env:MEDISTOCK_API_BASE_URL="http://localhost:5050"
$env:AGENT_SERVICE_TOKEN="medistock-internal-agent-token-2024"
$env:INTERNAL_TOKEN="medistock-internal-agent-token-2024"

# Start uvicorn
python -m uvicorn medistock_agents.main:app --host 0.0.0.0 --port 8000
```
Verify health:
- `http://localhost:8000/health` (Returns `{"status":"healthy","service":"medistock-agent-service","version":"1.0.0"}`)

### Step 4: Start the React Web Portal
Open Terminal 3:
```powershell
cd web
npm install
npm run dev -- --host 0.0.0.0 --port 5173
```
Open your browser to:
- `http://localhost:5173/`

### Step 5: Run the Flutter Mobile Application
Open Terminal 4:
```powershell
cd mobile
flutter pub get
flutter run -d chrome # Or target connected Android device / emulator
```
For Android Emulators: The mobile client automatically defaults to `http://10.0.2.2:5050` to bridge through the host loopback.

---

## 5. Seed Accounts & Test Credentials

The database initializes automatically with deterministic seed users covering all supported system roles:

| Email Address | Password | Assigned System Role | Primary Responsibilities |
|---|---|---|---|
| `admin@medistock.com` | `Password123!` | `Administrator`, `ADMIN` | User administration, audit trail, global multi-facility override |
| `manager@medistock.com` | `Password123!` | `FacilityManager`, `FACILITY_MANAGER` | Coordinator console, PO approval (< $10k), transfer sign-offs |
| `store@medistock.com` | `Password123!` | `OperationalStaff`, `STORE_OFFICER` | Physical inventory intake, batch scanning, FEFO stock adjustments |
| `supplier@medistock.com` | `Password123!` | `SupplierOfficer`, `SUPPLIER_OFFICER` | Supplier catalog updates, purchase order fulfillment tracking |
| `officer@medistock.com` | `Password123!` | `FieldOfficer`, `FIELD_OFFICER` | Mobile delivery tracking, transit dispatch, physical drop-off |

---

## 6. Running Automated Verification Suites

The repository contains 1,062 passing automated tests across the four technology stacks. Execute them using these commands:

### 6.1 Backend Tests (.NET xUnit)
```powershell
dotnet test backend/tests/MediStock.UnitTests/MediStock.UnitTests.csproj       # 231 tests
dotnet test backend/tests/MediStock.ApiTests/MediStock.ApiTests.csproj         # 1 test
dotnet test backend/tests/MediStock.IntegrationTests/MediStock.IntegrationTests.csproj # 130 tests
dotnet test backend/tests/MediStock.Api.Tests/MediStock.Api.Tests.csproj       # 168 tests
```
*Total Backend Tests:* **530 Passed**

### 6.2 Agent Service Tests (pytest)
```powershell
agent-service\.venv\Scripts\pytest.exe agent-service/tests
```
*Total Agent Tests:* **233 Passed**

### 6.3 Web Frontend Tests (Vitest)
```powershell
cd web
npm test -- --run
```
*Total Web Tests:* **207 Passed**

### 6.4 Mobile Tests (Flutter test)
```powershell
cd mobile
flutter analyze  # 0 issues
flutter test     # 92 tests
```
*Total Mobile Tests:* **92 Passed**

---

## 7. Troubleshooting Local Issues

### Ambiguous Controller Constructor
- *Symptom:* `InvalidOperationException: Multiple constructors accepting all given argument types have been found in type 'AuthController'.`
- *Resolution:* Ensure `[ActivatorUtilitiesConstructor]` is declared on the primary dependency injection constructor in `AuthController.cs`.

### Swagger Conflicting Actions
- *Symptom:* `SwaggerGeneratorException: Conflicting method/path combination "GET api/notifications"`.
- *Resolution:* Ensure `options.ResolveConflictingActions(apiDescriptions => apiDescriptions.First());` is declared in `Program.cs`.

### Docker Port Conflicts
- *Symptom:* `bind: address already in use 0.0.0.0:5430`.
- *Resolution:* Check running containers with `docker ps` or verify if another PostgreSQL instance is bound to port 5430. Change `POSTGRES_PORT` in `.env` if necessary.
