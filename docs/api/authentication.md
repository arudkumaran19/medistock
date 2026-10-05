# Authentication API

## Endpoints

| Method | Endpoint | Request body | Access |
| --- | --- | --- | --- |
| POST | `/api/auth/register` | `email`, `password`, `confirmPassword`, `firstName`, `lastName`, `role` | Anonymous |
| POST | `/api/auth/login` | `email`, `password` | Anonymous |
| POST | `/api/auth/refresh` | `refreshToken` | Anonymous |
| POST | `/api/auth/logout` | `refreshToken` | Anonymous |
| GET | `/api/auth/me` | — | Authenticated |

## Token response and use

Registration, successful login, and successful refresh return a `LoginResponse`
object directly, not inside the usual API `data` envelope:

```json
{
  "accessToken": "...",
  "refreshToken": "...",
  "expiresAt": "...",
  "userId": "...",
  "email": "...",
  "roles": ["OperationalStaff"]
}
```

Send the access token as a bearer token on authenticated requests. Access tokens are
signed with HMAC-SHA256 and contain the subject, email, and role claims. The
configured issuer and audience are validated by the API. Default lifetimes are 60
minutes for access tokens and 7 days for refresh tokens.

`POST /api/auth/refresh` accepts `{ "refreshToken": "..." }`. A valid active refresh
token is revoked and replaced as part of issuing a new access/refresh token pair.
`POST /api/auth/logout` accepts the same body and revokes the matching active refresh
token; it returns 204 No Content.

`GET /api/auth/me` requires authentication and returns `userId`, `email`, and the
current user's role list.

## Registration and authentication failures

`POST /api/auth/register` accepts `email`, `password`, `confirmPassword`,
`firstName`, `lastName`, and `role`. Public registration assigns the
`OperationalStaff` role; requesting `Administrator` or `FacilityManager` is rejected.

Invalid login credentials return 401 with code `INVALID_CREDENTIALS`. An invalid or
expired refresh token returns 401 with code `INVALID_REFRESH_TOKEN`. Registration
validation failures are handled as API errors; see the [error contract](error-contract.md).