# Local Service Startup Order

Start the database before the API, since the API applies migrations and seed data
during startup. Start the agent service after the API because it reads and writes
inventory through the API. Start either client after its required API endpoint is
available.

## 1. Configure local settings

Set PostgreSQL credentials and `ConnectionStrings__DefaultConnection`, and provide
the API's required JWT issuer, audience, and signing key. The signing key must be at
least 32 characters. See [environment variables](environment-variables.md) for
service-specific names, defaults, and the documented port differences.

## 2. Start PostgreSQL

From the repository root:

```bash
docker compose up -d postgres
```

The compose service requires `POSTGRES_DB`, `POSTGRES_USER`, and
`POSTGRES_PASSWORD`. Its default host port is `5430`, mapped to container port `5432`;
the API connection string must use the host-side port.

## 3. Start the ASP.NET Core API

From the repository root:

```bash
dotnet run --project backend/src/MediStock.Api/MediStock.Api.csproj --launch-profile http
```

The `http` launch profile listens on `http://localhost:5050`. During startup, the API
applies EF Core migrations (or ensures the database is created when migrations are
not present), applies seed data, and seeds users. Wait for the API to start before
starting dependent services.

## 4. Start the inventory agent service (when needed)

Install the agent service dependencies and run its FastAPI app from the
`agent-service` directory:

```bash
python -m pip install -r requirements.txt
python -m pip install -e .
python -m uvicorn medistock_agents.main:app --reload --port 8000
```

Set `MEDISTOCK_API_BASE_URL` to the API listener. The adapter code fallback is port
`5182`, while the local API launch profile uses port `5050`.

## 5. Start a client

For the React client, from `web`:

```bash
npm ci
npm run dev
```

Set `VITE_API_URL` and, when using the Inventory Intelligence Agent panel,
`VITE_AGENT_API_URL` to the corresponding service listeners.

For Flutter, from `mobile`:

```bash
flutter pub get
flutter run --dart-define=API_URL=http://localhost:5050
```

For the Android emulator, use `http://10.0.2.2:5050` as the `API_URL` value.
Physical-device access requires an API listener reachable from the device and a
matching `API_URL`.