# Deployment Guide

## Docker Compose (Full Stack)

The provided `docker-compose.yml` runs PostgreSQL and the API together.

```bash
# Build the API image
docker-compose build api

# Start everything (PostgreSQL + API)
docker-compose up -d

# Apply database migrations
docker-compose exec api npx prisma migrate deploy

# Seed default users (first deploy only)
docker-compose exec api npx prisma db seed

# View API logs
docker-compose logs -f api
```

The API is available at `http://localhost:4000`. The frontend (`apps/web`) is not included in the docker-compose setup and should be deployed separately (see below).

To stop:

```bash
docker-compose down          # stop containers, keep data volume
docker-compose down -v       # stop containers AND delete PostgreSQL data
```

---

## Building the Docker Image

The `Dockerfile` at the repository root uses a two-stage build:

1. **builder** — installs all dependencies, generates Prisma client, runs `npm run build`
2. **production** — copies compiled output only, runs `npm ci --omit=dev`

```bash
# Build
docker build -t auto8-api .

# Run standalone (provide DATABASE_URL and JWT_SECRET)
docker run -d \
  -p 4000:4000 \
  -e DATABASE_URL="postgresql://user:pass@host:5432/auto8" \
  -e JWT_SECRET="your-long-random-secret" \
  -e NODE_ENV=production \
  auto8-api
```

The image `CMD` runs `npx prisma migrate deploy && node dist/main.js`, so pending migrations are automatically applied on container startup.

---

## Environment Variables Reference

All variables for `apps/api`. Set these in your deployment platform's secret manager or `.env` file.

| Variable | Required | Default | Description |
|---|---|---|---|
| `DATABASE_URL` | **yes** | — | PostgreSQL connection string (`postgresql://user:pass@host:5432/db`) |
| `API_PORT` | no | `4000` | Port the NestJS API binds to |
| `JWT_SECRET` | **yes** | — | Secret for signing JWTs — must be a long random string |
| `JWT_ACCESS_EXPIRES_IN` | no | `15m` | Access token lifetime |
| `JWT_REFRESH_EXPIRES_IN` | no | `7d` | Refresh token lifetime |
| `JWT_EXPIRES_IN` | no | `24h` | Legacy fallback expiry |
| `ALLOWED_ORIGINS` | no | `http://localhost:3000` | Comma-separated CORS allowed origins |
| `FRONTEND_URL` | no | `http://localhost:3000` | Base URL for password reset email links |
| `SLACK_SIGNING_SECRET` | no | — | Slack app signing secret |
| `SLACK_ALLOWED_WORKSPACE_IDS` | no | — | Comma-separated allowed Slack workspace IDs |
| `SLACK_BOT_TOKEN` | no | — | Slack bot OAuth token |
| `GMAIL_CONNECTOR_SECRET` | no | — | Random secret for protecting `POST /connectors/gmail/sync` |
| `GMAIL_CLIENT_ID` | no | — | Google OAuth client ID |
| `GMAIL_CLIENT_SECRET` | no | — | Google OAuth client secret |
| `GMAIL_REFRESH_TOKEN` | no | — | Google OAuth refresh token |
| `GMAIL_SEARCH_QUERY` | no | `subject:RFQ is:unread` | Gmail search filter |
| `GMAIL_MAX_RESULTS` | no | `20` | Max messages per sync |
| `GMAIL_CRON_SCHEDULE` | no | `0 * * * *` | Cron expression for Gmail auto-sync |
| `OPENAI_API_KEY` | no | — | OpenAI API key; enables AI features |
| `OPENAI_MODEL` | no | `gpt-4o-mini` | OpenAI model name |
| `QUOTE_EMAIL_AI` | no | `false` | Set `true` to enable AI-generated email subjects |
| `RFQ_CLASSIFICATION_THRESHOLD` | no | `0.7` | LLM classification score threshold (0–1) |
| `SMTP_HOST` | no | — | SMTP server hostname |
| `SMTP_PORT` | no | `587` | SMTP port |
| `SMTP_USER` | no | — | SMTP authentication username |
| `SMTP_PASS` | no | — | SMTP authentication password |
| `QUOTE_EMAIL_FROM` | no | — | Optional sender-address override for quote emails |
| `SMTP_SECURE` | no | `true` | `true` = enforce TLS; `false` = allow plain/STARTTLS (dev only) |
| `ATTACHMENT_STORAGE_PATH` | no | `./attachments` | Local directory for parsed attachment files |
| `GOOGLE_SHEET_ID` | no | — | Google Sheets spreadsheet ID for quote export |
| `GOOGLE_SERVICE_ACCOUNT_KEY` | no | — | JSON string of Google service account credentials |
| `CONNECTOR_AUTO_DISABLE_THRESHOLD` | no | `5` | Consecutive failures before a connector is auto-disabled |
| `CREDENTIALS_ENCRYPTION_KEY` | no | — | 64-hex-char AES-256-GCM key for encrypting DB-stored connector credentials |
| `OUTLOOK_CLIENT_ID` | no | — | Outlook / Microsoft Graph client ID for env-var bootstrap |
| `OUTLOOK_CLIENT_SECRET` | no | — | Outlook / Microsoft Graph client secret |
| `OUTLOOK_REFRESH_TOKEN` | no | — | Outlook refresh token |
| `OUTLOOK_TENANT_ID` | no | `common` | Outlook tenant ID or `common` |

---

## CI/CD Pipeline

GitHub Actions workflow: `.github/workflows/ci.yml`

Three sequential jobs triggered on pushes and pull requests to `main`:

```
typecheck  →  build  →  test
```

| Job | Steps |
|---|---|
| `typecheck` | `npm run typecheck` — strict TypeScript check across all workspaces |
| `build` | `npm run build` — compiles API and frontend |
| `test` | `prisma db push --force-reset`, then `npm run test` — 58 passing unit + e2e tests against live PostgreSQL |

The `test` job spins up a `postgres:16` service container with:
- `POSTGRES_DB=auto8_test`
- `POSTGRES_USER=postgres`
- `POSTGRES_PASSWORD=postgres`

And sets `DATABASE_URL=postgresql://postgres:postgres@localhost:5432/auto8_test`.

---

## Deploying the Frontend

The Next.js frontend (`apps/web`) is a standard App Router application. Deploy to any Node.js-compatible host:

**Build:**
```bash
cd apps/web
npm run build
npm start    # production server
```

**Environment variables for `apps/web`:**

| Variable | Description |
|---|---|
| `NEXT_PUBLIC_API_BASE_URL` | API base URL (e.g., `https://api.yourdomain.com`) — set if API is on a different domain |

If the API and web app share the same domain (e.g., web at `/`, API at `/api`), no environment variable is needed as requests default to the same host.

---

## Production Checklist

Before deploying to a production environment:

- [ ] **Change `JWT_SECRET`** — use a cryptographically random string (e.g., `openssl rand -hex 64`)
- [ ] **Change default user passwords** via the admin UI (Settings → Users) or re-seed with new passwords
- [ ] **Set `ALLOWED_ORIGINS`** to your frontend domain only (e.g., `https://app.yourdomain.com`)
- [ ] **Set `FRONTEND_URL`** to your frontend domain (used in password reset emails)
- [ ] **Set `DATABASE_URL`** to a managed PostgreSQL instance (not the docker-compose default)
- [ ] **Run `prisma migrate deploy`** on first deployment (handled automatically in Docker CMD)
- [ ] **Enable SMTP_SECURE=true** and point `SMTP_*` vars at a production mail relay
- [ ] **Set `CREDENTIALS_ENCRYPTION_KEY`** before enabling DB-managed Gmail / Outlook / Slack connectors
- [ ] **Restrict admin access** — ensure `admin@auto8.dev` password has been changed
- [ ] **Set up HTTPS** — place the API and frontend behind a reverse proxy (nginx, Caddy, or a cloud load balancer) with TLS certificates
- [ ] **Configure `ATTACHMENT_STORAGE_PATH`** to a persistent volume mount (not ephemeral container storage)
- [ ] **Review `CONNECTOR_AUTO_DISABLE_THRESHOLD`** — lower value means more aggressive auto-disabling on errors
- [ ] **Set `OUTLOOK_*` vars only if you want env-var bootstrap** — otherwise manage Outlook connectors entirely from the admin UI
