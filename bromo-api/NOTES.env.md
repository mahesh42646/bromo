# Bromo API — environment variables

Copy into `bromo-api/.env`. Never commit secrets.

| Variable | Purpose |
|----------|---------|
| `MONGODB_URI` | MongoDB connection string |
| `JWT_SECRET` | Admin JWT signing |
| `JWT_EXPIRES_IN` | User JWT expiry string |
| `ADMIN_SESSION_TTL` | Admin session TTL (e.g. `8h`) |
| `PORT` | HTTP port (default 4000) |
| `NODE_ENV` | `development` \| `production` |
| `CORS_ORIGIN` | Comma-separated origins or `*` |
| `GOOGLE_PLACES_API_KEY` | Google Places / Nearby Search (alias `GOOGLE_PLACES_KEY` also read in code) |
| `TURN_SECRET` | Shared secret for coturn REST credentials |
| `TURN_URLS` | Comma-separated `turn:host:3478` URIs |
| `AWS_REGION`, `S3_BUCKET`, `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY` | Optional S3 mirror for uploads |
| `FCM_PROJECT_ID`, `FCM_CLIENT_EMAIL`, `FCM_PRIVATE_KEY` | Firebase Admin push (service account) |
| `ALLOW_DUMMY_SELF_TOPUP` | Set `1` in prod only if using dummy wallet top-up |

Firebase client SDK uses its own config on mobile; API uses service account for server-side push.
