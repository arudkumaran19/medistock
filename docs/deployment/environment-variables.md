# Environment Variables

This reference describes configuration read by the current local-development
clients and services. Keep populated `.env` files and real credentials out of
version control.

## PostgreSQL and ASP.NET Core API

| Variable | Purpose |
| --- | --- |
| `POSTGRES_DB`, `POSTGRES_USER`, `POSTGRES_PASSWORD` | Required by `compose.yaml` to create the PostgreSQL database and user. |
| `POSTGRES_PORT` | Optional host port mapped to PostgreSQL's container port `5432`; defaults to `5430`. |
| `ConnectionStrings__DefaultConnection` | ASP.NET Core PostgreSQL connection string. Its host port must match the host-side `POSTGRES_PORT` mapping. |
| `Jwt__Issuer`, `Jwt__Audience`, `Jwt__SigningKey` | Required JWT configuration. Flat aliases `JWT_ISSUER`, `JWT_AUDIENCE`, and `JWT_SIGNING_KEY` are also supported. |
| `Jwt__AccessTokenExpirationMinutes`, `Jwt__RefreshTokenExpirationDays` | Optional token lifetime settings; defaults are 60 minutes and 7 days. Flat `JWT_ACCESS_TOKEN_EXPIRATION_MINUTES` and `JWT_REFRESH_TOKEN_EXPIRATION_DAYS` aliases are supported. |
| `ASPNETCORE_ENVIRONMENT` | ASP.NET Core environment; local launch profiles use `Development`. |

The signing key must contain at least 32 characters. The backend loads a repository
root `.env` or `backend/.env` during startup, preferring the root file when both
exist. Environment variables already set by the host take precedence over values
loaded from those files. The local `http` launch profile listens on
`http://localhost:5050`; the `https` profile also listens on that HTTP address.

`compose.yaml` maps PostgreSQL container port `5432` to host port `5430` by default.
Ensure `ConnectionStrings__DefaultConnection` uses the mapped host port rather than
assuming the container port is exposed directly.

## React web client

| Variable | Purpose |
| --- | --- |
| `VITE_API_URL` | ASP.NET Core API base URL; the client-code fallback is `http://localhost:5050`. |
| `VITE_AGENT_API_URL` | Agent service base URL; the client-code fallback is `http://127.0.0.1:8000`. |

Vite exposes `VITE_`-prefixed values to browser code. Use non-secret URLs only.
The checked-in `web/.env.example` currently points `VITE_API_URL` to port `5182`,
while the ASP.NET Core local launch profiles listen on port `5050`; set the variable
to the actual API listener when using those profiles.

## Inventory agent service

| Variable | Purpose |
| --- | --- |
| `MEDISTOCK_API_BASE_URL` | ASP.NET Core API base URL used by the inventory adapter; code fallback is `http://localhost:5182`. |
| `MEDISTOCK_JWT_TOKEN` | Optional bearer token supplied to the adapter. |

The agent service loads `agent-service/.env` and the repository root `.env`. Its
checked-in examples use API port `5182`, whereas the ASP.NET Core local launch
profiles use `5050`; set `MEDISTOCK_API_BASE_URL` to the listener actually in use.

## Flutter client

`ApiClient` reads a compile-time Dart define named `API_URL`. If it is not provided,
the default is `http://10.0.2.2:5050` on the Android emulator and
`http://localhost:5050` on other supported targets.

The checked-in `mobile/.env.example` names `API_BASE_URL`, but `ApiClient` does not
read that variable. To override the URL, pass `API_URL` with Flutter's
`--dart-define` option when building or running the app.