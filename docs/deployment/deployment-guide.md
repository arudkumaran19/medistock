# Deployment Guide

Shared deployment documentation, owned by Sathurstiga S. (IT24103156) according to the final blueprint.

MediStock is deployed on free tiers (blueprint section 58):

| Component | Platform | Source folder | Runtime |
| --- | --- | --- | --- |
| PostgreSQL | Neon (free) | - | Managed PostgreSQL |
| ASP.NET Core API | Render Web Service | `backend/` | Docker (`backend/Dockerfile`) |
| Agentic AI service | Render Web Service | `agent-service/` | Docker (`agent-service/Dockerfile`) |
| React web app | Render Static Site | `web/` | `npm ci && npm run build`, publish `dist` |
| Flutter app | Android APK | `mobile/` | `flutter build apk --release` |

No secret is stored in the repository. Every value below is entered in the Neon or
Render dashboard. Only the variable **names** belong in reports.

## Startup order

1. Neon database (always on).
2. Agent service.
3. ASP.NET Core API. On start it applies all EF Core migrations and seeds the reference
   data and demo users, so an empty Neon database is ready after the first start.
4. React static site.
5. Android APK (points at the deployed API).

Render free web services sleep after a period without traffic and take about a minute
to wake. Before a demonstration, open the API `/health`, the agent `/health` and the
React URL first.

## 1. Neon PostgreSQL

1. Create a Neon project (region close to the Render region) and a database.
2. Copy the connection details and convert them to the Npgsql format:

   ```text
   Host=<neon-host>;Database=<db>;Username=<user>;Password=<password>;SSL Mode=Require;Trust Server Certificate=true
   ```

3. Use this as `ConnectionStrings__DefaultConnection` on the API service. Migrations run
   automatically when the API starts.

## 2. Agent service (Render Web Service, Docker)

- Root directory: `agent-service`
- Dockerfile path: `./Dockerfile`
- Health check path: `/health`

| Variable | Value |
| --- | --- |
| `MEDISTOCK_API_BASE_URL` | Deployed API URL, e.g. `https://<api>.onrender.com` |
| `AGENT_SERVICE_TOKEN` | Long random shared secret. Must equal the API's `AgentService__ServiceToken`. |
| `GEMINI_API_KEY` | Google AI Studio key. Without it the agents fall back to deterministic results. |
| `GEMINI_MODEL` | e.g. `gemini-3.6-flash` |
| `CORS_ALLOWED_ORIGINS` | Deployed React URL, e.g. `https://<web>.onrender.com` |

## 3. ASP.NET Core API (Render Web Service, Docker)

- Root directory: `backend`
- Dockerfile path: `./Dockerfile`
- Health check path: `/health`

| Variable | Value |
| --- | --- |
| `ASPNETCORE_ENVIRONMENT` | `Production` (already the image default). The development token endpoint returns 404. |
| `ConnectionStrings__DefaultConnection` | Neon connection string from step 1 |
| `Jwt__SigningKey` | Random string of at least 32 characters |
| `Jwt__Issuer` | `MediStock` |
| `Jwt__Audience` | `MediStock` |
| `AgentService__BaseUrl` | Deployed agent URL, e.g. `https://<agent>.onrender.com` |
| `AgentService__ServiceToken` | Same value as the agent's `AGENT_SERVICE_TOKEN` |
| `AgentService__TimeoutSeconds` | `60` (allows for the agent waking from sleep) |
| `CORS_ALLOWED_ORIGINS` | Deployed React URL, e.g. `https://<web>.onrender.com` (comma-separated for several) |

Swagger stays enabled in Production because evaluators need it
(`Swagger__Enabled=false` turns it off).

Verify:

- `https://<api>.onrender.com/health` returns `{"status":"ok"}`
- `https://<api>.onrender.com/swagger` opens the API documentation

## 4. React web app (Render Static Site)

- Root directory: `web`
- Build command: `npm ci && npm run build`
- Publish directory: `dist`
- Redirect/rewrite rule: source `/*`, destination `/index.html`, action **Rewrite**
  (client-side routes would otherwise return 404)

| Variable | Value |
| --- | --- |
| `VITE_API_URL` | Deployed API URL |
| `VITE_AGENT_API_URL` | Deployed agent URL (used by the Inventory Intelligence panel) |

`VITE_` values are compiled into the bundle at build time, so redeploy the static site
after changing them. They are URLs only, never secrets.

## 5. Flutter APK

```bash
cd mobile
flutter build apk --release --dart-define=API_URL=https://<api>.onrender.com
```

Output: `mobile/build/app/outputs/flutter-apk/app-release.apk`. Install it on an
Android device, sign in and record a consumption entry to confirm it reaches the
deployed API.

## Test accounts

Seeded on first start (password `Password123!`):

| Role | Email |
| --- | --- |
| Facility manager | `manager@medistock.com` |
| Store officer | `store@medistock.com` |
| Admin | `admin@medistock.com` |
| Supplier officer | `supplier@medistock.com` |

## Verification checklist

- [ ] API `/health` and `/swagger` open
- [ ] Agent `/health` returns `{"status":"ok"}`
- [ ] React URL loads and each role can sign in
- [ ] Inventory, Procurement, Demand (Shortages, Scan now, Run agent) and Redistribution pages load
- [ ] APK signs in and records consumption; the alert appears in React
- [ ] Every link opens in a private/incognito window
- [ ] Services stay reachable until 21 October 2026 (assignment access period)

## Known limitation

The Inventory Intelligence panel calls the agent service directly from the browser
(`VITE_AGENT_API_URL`). The assignment states that clients should reach the agent only
through ASP.NET Core; routing that panel through the API is a recommended follow-up.
