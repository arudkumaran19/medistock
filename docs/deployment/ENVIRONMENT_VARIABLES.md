# MediStock Environment Variables Master Reference

**Document Version:** 1.0.0  
**Target Environments:** Local Docker Compose, Native Dev, Neon Cloud, Render Services, Vercel, and GitHub Actions  
**Security Classification:** Strict — Contains no live credentials; all sensitive entries are masked placeholders.  

---

## 1. Overview and Security Principles

1. **Defense-in-Depth Separation:** Configuration is strictly partitioned between client-facing public variables (e.g., `VITE_API_URL`) and server-only secrets (e.g., `JWT_SIGNING_KEY`, `AGENT_SERVICE_TOKEN`, `ConnectionStrings__DefaultConnection`).
2. **Public Build Exposure Warning:** All variables prefixed with `VITE_` or passed via `--dart-define` are embedded in client binary/JavaScript bundles and visible to end users in browser source inspection. Never place database passwords, JWT signing keys, or API private tokens in frontend configuration.
3. **Internal Service Authentication:** The Python Agent Service and ASP.NET Core Backend communicate over an internal network channel authenticated via the shared secret header `X-Internal-Token`.

---

## 2. Environment Variable Master Inventories

### 2.1 Local Root `.env` and Docker Compose

| Exact Variable Name | Required? | Relevant Service | Local Development Value | Production Value / Format | Where to Obtain It | Secret? | Where to Configure It | Used By / Evidence |
|---|---|---|---|---|---|---|---|---|
| `POSTGRES_DB` | Yes | `postgres`, `backend` | `medistock` | `<YOUR_NEON_DB_NAME>` | Local default / Neon database console | No | Root `.env`, Compose | `compose.yaml` line 7 |
| `POSTGRES_USER` | Yes | `postgres`, `backend` | `medistock` | `<YOUR_NEON_USER>` | Local default / Neon role console | No | Root `.env`, Compose | `compose.yaml` line 8 |
| `POSTGRES_PASSWORD` | Yes | `postgres`, `backend` | `medistock_dev_password` | `<YOUR_NEON_STRONG_PASSWORD>` | Generate strong password / Neon dashboard | **YES** | Root `.env`, Render/Neon | `compose.yaml` line 9 |
| `POSTGRES_PORT` | No | `postgres` | `5430` | `5432` | Host port preference | No | Root `.env` | `compose.yaml` line 11 |
| `POSTGRES_IMAGE` | No | `postgres` | `postgres:17` | Managed Neon | Docker Hub default | No | Root `.env` | `compose.yaml` line 3 |
| `AGENT_SERVICE_TOKEN` | Yes | `backend`, `agent-service` | `medistock-internal-agent-token-2024` | `<GENERATED_64_CHAR_TOKEN>` | Generate via `openssl rand -hex 32` | **YES** | Root `.env`, Render env | `compose.yaml` lines 32, 56 |
| `JWT_ISSUER` | Yes | `backend` | `MediStock.Api` | `MediStock.Api` | Fixed architectural string | No | Root `.env`, Render env | `Program.cs` line 148 |
| `JWT_AUDIENCE` | Yes | `backend` | `MediStock.Client` | `MediStock.Client` | Fixed architectural string | No | Root `.env`, Render env | `Program.cs` line 153 |
| `JWT_SIGNING_KEY` | Yes | `backend` | `MediStockSecretKeyForAuthenticationAndJwtTokenGeneration12345!` | `<GENERATED_64_CHAR_BASE64_KEY>` | Generate via `openssl rand -base64 64` | **YES** | Root `.env`, Render env | `Program.cs` line 158 |
| `OPENROUTESERVICE_API_KEY` | No | `backend` | *(empty string)* | `<YOUR_ORS_API_KEY>` | `openrouteservice.org` dashboard | **YES** | Root `.env`, Render env | `Program.cs` line 345 |
| `SEED_DEMO_DATA` | No | `backend` | `true` | `false` | Development flag | No | Root `.env`, Render env | `compose.yaml` line 39 |

---

### 2.2 ASP.NET Core Backend

| Exact Variable Name | Required? | Local Value | Production Value / Format | Where to Obtain It | Secret? | Where to Configure | Used By / Evidence |
|---|---|---|---|---|---|---|---|
| `ConnectionStrings__DefaultConnection` | Yes | `Host=localhost;Port=5430;Database=medistock;Username=medistock;Password=medistock_dev_password` | `Host=<NEON_HOST>;Port=5432;Database=<DB>;Username=<USER>;Password=<PASSWORD>;SSL Mode=Require;Trust Server Certificate=true` | Neon Project Dashboard ("Connection Details") | **YES** | `appsettings.json`, Render Dashboard | `Program.cs` lines 117, 131 |
| `AgentService__BaseUrl` | Yes | `http://localhost:8000` | `https://<YOUR_AGENT_SERVICE>.onrender.com` | Render Agent Service public URL | No | Render Backend Environment | `Program.cs` lines 338-341 |
| `AgentService__ServiceToken` | Yes | `medistock-internal-agent-token-2024` | `<MATCHING_AGENT_SERVICE_TOKEN>` | Matches `AGENT_SERVICE_TOKEN` on Python service | **YES** | Render Backend Environment | `AgentGateway.cs` |
| `AgentService__TimeoutSeconds` | No | `30` | `60` | Fixed configuration | No | `appsettings.json`, Render env | `Program.cs` line 342 |
| `ASPNETCORE_ENVIRONMENT` | Yes | `Development` | `Production` | Deployment environment name | No | Render Environment Variables | `Program.cs` line 476 |
| `CORS_ALLOWED_ORIGINS` | Yes | `http://localhost:5173,http://localhost:3000` | `https://<YOUR_WEB_APP>.vercel.app` | Vercel Project URL | No | Render Backend Environment | `Program.cs` CORS middleware |
| `PORT` | No | `5050` | `10000` (Assigned by Render) | Render runtime host assignment | No | Automatic on Render | `Program.cs` Kestrel binding |

---

### 2.3 Python Agent Service (LangGraph)

| Exact Variable Name | Required? | Local Value | Production Value / Format | Where to Obtain It | Secret? | Where to Configure | Used By / Evidence |
|---|---|---|---|---|---|---|---|
| `ENVIRONMENT` | Yes | `development` | `production` | Deployment environment name | No | Render Environment Variables | `config.py` |
| `MEDISTOCK_API_BASE_URL` | Yes | `http://localhost:5050` | `https://<YOUR_BACKEND_API>.onrender.com` | Render Backend Web Service URL | No | Render Agent Environment | `tools/procurement_tools.py` |
| `AGENT_SERVICE_TOKEN` | Yes | `medistock-internal-agent-token-2024` | `<MATCHING_AGENT_SERVICE_TOKEN>` | Shared secret matching Backend | **YES** | Render Agent Environment | `coordinator_routes.py` line 25 |
| `GEMINI_API_KEY` | No | *(empty string)* | `<YOUR_GOOGLE_AI_STUDIO_KEY>` | `aistudio.google.com` API console | **YES** | Render Agent Environment | `provider.py` |
| `GEMINI_MODEL` | No | `gemini-1.5-flash` | `gemini-1.5-flash` | Fixed model name | No | Render Agent Environment | `provider.py` |
| `PORT` | No | `8000` | `10000` (Assigned by Render) | Render runtime host assignment | No | Automatic on Render | `main.py` uvicorn runner |

---

### 2.4 React / Vite Web Frontend

| Exact Variable Name | Required? | Local Value | Production Value / Format | Where to Obtain It | Secret? | Where to Configure | Used By / Evidence |
|---|---|---|---|---|---|---|---|
| `VITE_API_URL` | Yes | `http://localhost:5050` | `https://<YOUR_BACKEND_API>.onrender.com` | Deployed ASP.NET Core URL | No | `web/.env`, Vercel Dashboard | `src/services/apiClient.ts` |
| `VITE_AGENT_API_URL`| No | `http://localhost:8000` | `https://<YOUR_AGENT_SERVICE>.onrender.com` | Deployed Python Agent URL | No | `web/.env`, Vercel Dashboard | `src/features/coordinator/` |

---

### 2.5 Flutter Mobile Build Configuration

| Exact Compile-Time Define | Required? | Local Emulator Value | Production Device Value | Where to Obtain It | Secret? | How to Pass | Used By / Evidence |
|---|---|---|---|---|---|---|---|
| `API_URL` | Yes | `http://10.0.2.2:5050` | `https://<YOUR_BACKEND_API>.onrender.com` | Deployed ASP.NET Core URL | No | `--dart-define=API_URL=...` | `mobile/lib/core/network/api_client.dart` |
| `SIGNALR_URL` | No | `http://10.0.2.2:5050/hubs/transfers` | `https://<YOUR_BACKEND_API>.onrender.com/hubs/transfers` | Deployed SignalR Hub URL | No | `--dart-define=SIGNALR_URL=...` | `mobile/lib/core/network/signalr_client.dart` |

---

### 2.6 PostgreSQL / Neon Managed Database

| Exact Setting / Parameter | Required? | Local Value | Production Value / Format | Where to Obtain It | Secret? | Where to Enter |
|---|---|---|---|---|---|---|
| Host | Yes | `localhost` | `ep-cool-fog-123456.us-east-2.aws.neon.tech` | Neon Project Details | No | Connection String |
| Database | Yes | `medistock` | `neondb` (or `medistock`) | Neon Database Settings | No | Connection String |
| User | Yes | `medistock` | `<NEON_ROLE_NAME>` | Neon Roles & Privileges | No | Connection String |
| Password | Yes | `medistock_dev_password` | `<NEON_GENERATED_PASSWORD>` | Neon Password Reset / Creation | **YES** | Connection String |
| Port | Yes | `5430` (host) / `5432` | `5432` | Neon Default Port | No | Connection String |
| SSL Mode | Yes | `Prefer` | `Require` | Mandatory on Neon | No | Connection String |
| Trust Server Certificate | Yes | `true` | `true` | Neon SSL handshake | No | Connection String |

---

### 2.7 Vercel Project Environment Variables

| Variable Name | Environment Scope | Required Value | Notes |
|---|---|---|---|
| `VITE_API_URL` | Production & Preview | `https://<YOUR_BACKEND_API>.onrender.com` | Must match public HTTPS URL of Render Backend |
| `VITE_AGENT_API_URL`| Production & Preview | `https://<YOUR_AGENT_SERVICE>.onrender.com` | Optional fallback for direct agent telemetry |

---

### 2.8 Render Web Service Environment Variables

#### A. Backend Web Service (`medistock-backend`)
- `ASPNETCORE_ENVIRONMENT`: `Production`
- `ConnectionStrings__DefaultConnection`: Neon connection string with `SSL Mode=Require;Trust Server Certificate=true`
- `AgentService__BaseUrl`: `https://<YOUR_AGENT_SERVICE>.onrender.com`
- `AgentService__ServiceToken`: `<SECURE_64_CHAR_TOKEN>`
- `AgentService__TimeoutSeconds`: `60`
- `Jwt__Issuer`: `MediStock.Api`
- `Jwt__Audience`: `MediStock.Client`
- `Jwt__SigningKey`: `<SECURE_64_CHAR_BASE64_KEY>`
- `CORS_ALLOWED_ORIGINS`: `https://<YOUR_WEB_APP>.vercel.app`

#### B. Agent Web Service (`medistock-agent-service`)
- `ENVIRONMENT`: `production`
- `MEDISTOCK_API_BASE_URL`: `https://<YOUR_BACKEND_API>.onrender.com`
- `AGENT_SERVICE_TOKEN`: `<MATCHING_SECURE_64_CHAR_TOKEN>`
- `INTERNAL_TOKEN`: `<MATCHING_SECURE_64_CHAR_TOKEN>`
- `GEMINI_API_KEY`: `<OPTIONAL_GEMINI_API_KEY>`

---

### 2.9 GitHub Actions Secrets & Variables

| Secret / Variable Name | Scope | Used In Workflow | Purpose |
|---|---|---|---|
| `RENDER_API_KEY` | Repository Secret | `deploy.yml` (Optional CD) | Triggers automated deployment hook on Render |
| `VERCEL_TOKEN` | Repository Secret | `deploy.yml` (Optional CD) | Authenticates Vercel CLI deployments |
| `VERCEL_ORG_ID` | Repository Variable | `deploy.yml` | Vercel team/user organization identifier |
| `VERCEL_PROJECT_ID`| Repository Variable | `deploy.yml` | Target Vercel project identifier |
