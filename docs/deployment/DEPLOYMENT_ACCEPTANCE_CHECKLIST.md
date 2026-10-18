# MediStock Deployment & Operational Acceptance Checklist

**Document Version:** 1.0.0  
**Verification Scope:** Local Development Rig + Production Cloud Deployment  
**Auditor:** Quality Assurance & DevOps Engineering  

---

## 1. Acceptance Verification Matrix

| ID | Verification Item | Target Standard | Local Execution Result | Production Cloud Expectation | Verification Command / Evidence |
|---|---|---|---|---|---|
| **AC-01** | **Backend Service Health** | Responds `HTTP 200` with `{"status":"ok"}` on `/health` | **PASSED** | Expected within 60s (allowing cold start) | `curl -s http://localhost:5050/health` |
| **AC-02** | **Agent Service Health** | Responds `HTTP 200` with `{"status":"healthy",...}` on `/health` | **PASSED** | Expected on Render Agent Service | `curl -s http://localhost:8000/health` |
| **AC-03** | **Database Schema Readiness** | All 35 EF Core tables initialized | **PASSED** | Auto-migrated by `DbInitializer.cs` | `SELECT count(*) FROM information_schema.tables WHERE table_schema='public'` (35 rows) |
| **AC-04** | **Backend-to-Agent Bridge** | Backend successfully delegates to Agent Service | **PASSED** | Internal bridge verified | `GET /api/demand/agent/health` returns `healthy: True` |
| **AC-05** | **Authentication & JWT** | Valid login yields signed JWT & refresh token | **PASSED** | Signed with 64-char key in production | `POST /api/auth/login` (Admin token issued) |
| **AC-06** | **Role Authorization Guard** | Non-admin blocked from admin endpoints with `HTTP 403` | **PASSED** | Backend policy enforced | Policy authorization test suite |
| **AC-07** | **Web Application Load** | Single Page Application serves `index.html` with assets | **PASSED** | Served via Vercel Edge CDN | `GET http://localhost:5173/` returns `HTTP 200` |
| **AC-08** | **Vite Production Build** | Zero TypeScript compilation or bundling errors | **PASSED** | Pre-deployment build verified | `npm run build` in `web/` (638ms clean build) |
| **AC-09** | **Mobile Static Analysis** | Zero lint, type, or syntax issues | **PASSED** | Automated CI guard verified | `flutter analyze` in `mobile/` (0 issues) |
| **AC-10** | **Mobile Test Suite** | All widget and workflow unit tests pass | **PASSED** | 92 tests passing | `flutter test` in `mobile/` |
| **AC-11** | **Backend Unit & Integration Tests** | All domain rules and API contracts pass | **PASSED** | 530 tests passing | `dotnet test backend/tests/...` |
| **AC-12** | **Agent Service Multi-Agent Tests** | All 5 agents, safety gates, and tools pass | **PASSED** | 233 tests passing | `pytest agent-service/tests` |
| **AC-13** | **OpenAPI / Swagger Generation** | Generates valid OpenAPI v3 schema | **PASSED** | Enabled in Production for evaluators | `GET /swagger/v1/swagger.json` returns `HTTP 200` |
| **AC-14** | **Data Persistence on Restart** | Database records persist across container restarts | **PASSED** | Guaranteed by Neon / persistent volumes | Stop & restart container, data retained |
| **AC-15** | **CORS Network Security** | Cross-origin requests restricted to allowed web origins | **PASSED** | Vercel domain whitelisted | `CORS_ALLOWED_ORIGINS` in backend |

---

## 2. Pre-Flight Production Deployment Checklist

Complete this checklist prior to public evaluator demonstrations:

### Infrastructure & Cloud Providers
- [ ] Neon PostgreSQL project created in same geographical region as Render services.
- [ ] Neon connection string configured with `SSL Mode=Require;Trust Server Certificate=true`.
- [ ] Render Backend Web Service created using `backend/Dockerfile`.
- [ ] Render Agent Web Service created using `agent-service/Dockerfile`.
- [ ] Matching `AGENT_SERVICE_TOKEN` configured in both Render services.
- [ ] Cryptographically strong 64-character `JWT_SIGNING_KEY` configured in Backend.
- [ ] Vercel project imported from `web/` directory with `Vite` preset.
- [ ] `VITE_API_URL` set to Render Backend HTTPS URL on Vercel.
- [ ] Render Backend `CORS_ALLOWED_ORIGINS` updated to include deployed Vercel domain.

### Mobile Release Build
- [ ] Flutter dependencies verified (`flutter pub get`).
- [ ] Release APK compiled with live API URL:
  ```bash
  flutter build apk --release --dart-define=API_URL=https://<YOUR_RENDER_BACKEND>.onrender.com
  ```
- [ ] `app-release.apk` uploaded to GitHub Releases for evaluator download.

### 10-Minute Pre-Demo Warm-up
Because Render free services spin down after 15 minutes of inactivity:
- [ ] Send `GET https://<YOUR_RENDER_BACKEND>.onrender.com/health` (Wait 50s for wake-up).
- [ ] Send `GET https://<YOUR_RENDER_AGENT>.onrender.com/health` (Wait 50s for wake-up).
- [ ] Open Vercel web URL and test logging in with `admin@medistock.com` / `Password123!`.
- [ ] Open Coordinator Console (`/coordinator`) and send test query to confirm agent graph responds.
