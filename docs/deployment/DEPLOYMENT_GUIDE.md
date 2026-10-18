# MediStock Production Deployment Guide

**Document Version:** 1.0.0  
**Target Cloud Architecture:** Neon PostgreSQL + Render Docker Services + Vercel SPA + Android Release APK  
**Branch:** `develop` (Authoritative Production Tip)  

---

## 1. Cloud Architecture & Hosting Strategy

The production architecture separates public static assets from containerized microservices and managed cloud storage:

```
[ End Users / Public ]
        │
        ├───► Vercel (Global Edge CDN)
        │      └─► React 18 Web Application (SPA)
        │
        └───► Render (Cloud Docker Containers)
               ├─► ASP.NET Core Web API (Public HTTPS REST + SignalR)
               │      │
               │      ├───► Render Private Network (HTTP + X-Internal-Token)
               │      │      └─► Python LangGraph Agent Microservice
               │      │
               │      └───► Neon PostgreSQL (Managed Serverless Cloud DB)
               │             └─► 35 Relational Tables with EF Core Migrations
               │
[ Mobile Users ]
        │
        └───► Flutter Release APK (Direct HTTPS to Render Backend API)
```

| Component | Target Platform | Runtime / Container | Pricing Tier | Free Tier Considerations |
|---|---|---|---|---|
| **Database** | Neon Serverless PostgreSQL | PostgreSQL 16 / 17 | Free Tier | 0.5 GB storage, auto-suspend after inactivity |
| **Backend API** | Render Web Service | Docker (`backend/Dockerfile`) | Free Tier | Spins down after 15m idle; ~50s cold start wake-up |
| **Agent Service** | Render Web Service | Docker (`agent-service/Dockerfile`) | Free Tier | Spins down after 15m idle; wakes automatically on backend call |
| **Web Portal** | Vercel Static Hosting | Node.js / Vite build (`web/`) | Free Hobby | Unlimited edge bandwidth, instant global cache invalidation |
| **Mobile App** | Android Release APK | Flutter AOT binary | N/A (Direct) | Distributed directly via GitHub Releases or direct download |

---

## 2. Dependency-Aware Deployment Sequence

To ensure zero database schema errors or broken API endpoints, follow this exact deployment order:

```
Step 1: Provision Neon Database 
   │
   ▼
Step 2: Deploy ASP.NET Core Backend (Executes EF Core Migrations & Seeds)
   │
   ▼
Step 3: Deploy Python LangGraph Agent Service
   │
   ▼
Step 4: Deploy React Frontend on Vercel (Configured with Backend URL)
   │
   ▼
Step 5: Compile & Distribute Android Release APK (Configured with Backend URL)
```

---

## 3. Step 1: Provision Managed Database (Neon PostgreSQL)

1. Log in to the [Neon Console](https://console.neon.tech).
2. Click **Create Project**:
   - **Project Name:** `medistock-production`
   - **Postgres Version:** `17` (or `16`)
   - **Region:** Select the region closest to your Render services (e.g., `US East (Ohio)` or `Frankfurt`).
3. Once the database is ready, navigate to the **Dashboard** and locate **Connection Details**:
   - Change connection type to **Parameters**.
4. Construct your Npgsql-compatible connection string in this exact format:
   ```text
   Host=<YOUR_NEON_HOST>;Port=5432;Database=<YOUR_DATABASE>;Username=<YOUR_USERNAME>;Password=<YOUR_PASSWORD>;SSL Mode=Require;Trust Server Certificate=true
   ```
5. Note this connection string for Step 2.

---

## 4. Step 2: Deploy ASP.NET Core Backend (Render Web Service)

1. Log in to [Render Dashboard](https://dashboard.render.com).
2. Click **New +** > **Web Service**.
3. Connect your GitHub repository: `https://github.com/arudkumaran19/medistock.git`.
4. Configure service settings:
   - **Name:** `medistock-backend`
   - **Region:** Same region as Neon (e.g., `Ohio` or `Frankfurt`).
   - **Branch:** `develop`
   - **Root Directory:** *(leave blank — repository root)*
   - **Runtime:** `Docker`
   - **Dockerfile Path:** `backend/Dockerfile`
   - **Instance Type:** `Free`
5. Configure **Environment Variables**:
   ```ini
   ASPNETCORE_ENVIRONMENT=Production
   ConnectionStrings__DefaultConnection=Host=<YOUR_NEON_HOST>;Port=5432;Database=<YOUR_DB>;Username=<YOUR_USER>;Password=<YOUR_PASSWORD>;SSL Mode=Require;Trust Server Certificate=true
   AgentService__BaseUrl=https://medistock-agent-service.onrender.com
   AgentService__ServiceToken=<GENERATED_64_CHAR_TOKEN>
   AgentService__TimeoutSeconds=60
   Jwt__Issuer=MediStock.Api
   Jwt__Audience=MediStock.Client
   Jwt__SigningKey=<GENERATED_64_CHAR_BASE64_KEY>
   CORS_ALLOWED_ORIGINS=https://medistock.vercel.app,http://localhost:5173
   Swagger__Enabled=true
   ```
   > Generate keys via: `openssl rand -hex 32` for service token, `openssl rand -base64 64` for JWT signing key.
6. Click **Create Web Service**.
7. **Verification:**
   - Once build succeeds, open `https://medistock-backend.onrender.com/health`.
   - Expected JSON: `{"status":"ok"}`.
   - Database migrations and seed users are applied automatically on first startup.

---

## 5. Step 3: Deploy Python LangGraph Agent (Render Web Service)

1. In Render Dashboard, click **New +** > **Web Service**.
2. Connect the same repository: `https://github.com/arudkumaran19/medistock.git`.
3. Configure service settings:
   - **Name:** `medistock-agent-service`
   - **Region:** Same region as Backend.
   - **Branch:** `develop`
   - **Root Directory:** `agent-service`
   - **Runtime:** `Docker`
   - **Dockerfile Path:** `./Dockerfile`
   - **Instance Type:** `Free`
4. Configure **Environment Variables**:
   ```ini
   ENVIRONMENT=production
   MEDISTOCK_API_BASE_URL=https://medistock-backend.onrender.com
   AGENT_SERVICE_TOKEN=<MATCHING_GENERATED_64_CHAR_TOKEN>
   INTERNAL_TOKEN=<MATCHING_GENERATED_64_CHAR_TOKEN>
   GEMINI_API_KEY=<OPTIONAL_AI_STUDIO_KEY>
   ```
5. Click **Create Web Service**.
6. **Verification:**
   - Once deployed, open `https://medistock-agent-service.onrender.com/health`.
   - Expected JSON: `{"status":"healthy","service":"medistock-agent-service","version":"1.0.0"}`.

---

## 6. Step 4: Deploy React Frontend (Vercel)

1. Log in to [Vercel Dashboard](https://vercel.com).
2. Click **Add New...** > **Project**.
3. Import `arudkumaran19/medistock`.
4. Configure build settings:
   - **Framework Preset:** `Vite`
   - **Root Directory:** Click `Edit` and select `web`.
   - **Build Command:** `npm run build` (or `npm ci && npm run build`)
   - **Output Directory:** `dist`
5. Configure **Environment Variables**:
   - `VITE_API_URL`: `https://medistock-backend.onrender.com`
   - `VITE_AGENT_API_URL`: `https://medistock-agent-service.onrender.com`
6. Click **Deploy**.
7. **Client-Side Routing Notice:** The repository contains `web/vercel.json` with rewrite rules (`"source": "/(.*)", "destination": "/index.html"`), ensuring deep links such as `/coordinator`, `/transfers`, and `/inventory` reload seamlessly without 404 errors.

---

## 7. Step 5: Compile and Distribute Flutter Android App

1. Open your terminal in `mobile/`:
   ```powershell
   cd mobile
   flutter clean
   flutter pub get
   ```
2. Build the production release APK with the live Render Backend API URL passed via `--dart-define`:
   ```powershell
   flutter build apk --release --dart-define=API_URL=https://medistock-backend.onrender.com --dart-define=SIGNALR_URL=https://medistock-backend.onrender.com/hubs/transfers
   ```
3. Locate the compiled standalone APK at:
   `mobile/build/app/outputs/flutter-apk/app-release.apk`
4. **Distribution for Evaluators & University Demonstration:**
   - Upload `app-release.apk` as a binary asset to a GitHub Release on the repository.
   - Users can download and install directly on any Android device (enabling "Install from Unknown Sources").

---

## 8. Monitoring, Cold Starts, and Rollback

### 8.1 Handling Render Free Tier Cold Starts
Render free web services spin down after 15 minutes of inactivity.
- First request after sleep takes ~50 seconds to wake up the container.
- **Demo Tip:** 5 minutes before presenting, send a `GET` request to `/health` on both the backend and agent service to warm up containers.

### 8.2 Production Rollback Procedures
- **Vercel Web App:** Roll back instantly in the Vercel dashboard by clicking **Deployments** > Select previous working build > **Promote to Production**.
- **Render Backend / Agent:** In Render dashboard, click **Events** > Roll back to previous successful commit.
- **Neon Database Backups:** Neon automatically maintains point-in-time branch snapshots. Restore points can be branched in seconds via the Neon Console.
