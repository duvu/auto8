# Logging

auto8 uses [pino](https://getpino.io/) for structured JSON logging via [nestjs-pino](https://github.com/iamolegga/nestjs-pino).

## Default Setup

| Environment | Behaviour |
|---|---|
| Development (`NODE_ENV != production`) | `pino-pretty` with colorized output to stdout |
| Production | JSON to stdout (always), plus optional transports below |

In production, stdout JSON is always active. Additional transports are additive — they run alongside stdout via pino's [transport workers](https://getpino.io/#/docs/transports).

## Log Level

Set `LOG_LEVEL` to control the minimum log level:

```env
LOG_LEVEL=info
```

| Level | Description |
|---|---|
| `trace` | Very verbose, include request/response internals |
| `debug` | Debug statements |
| `info` | Normal operational messages (default) |
| `warn` | Warnings that don't stop the service |
| `error` | Errors requiring attention |
| `fatal` | Fatal errors (service will crash) |

## Transports

### CloudWatch (AWS)

Sends logs to an AWS CloudWatch Logs log group.

**Enable:**
```env
CLOUDWATCH_ENABLED=true
AWS_REGION=us-east-1
CLOUDWATCH_LOG_GROUP=/auto8/api
CLOUDWATCH_LOG_STREAM=api-instance-1   # optional — defaults to os.hostname()
AWS_ACCESS_KEY_ID=AKIAxxx
AWS_SECRET_ACCESS_KEY=xxxxxx
```

**IAM role vs explicit credentials:**
- In EC2/ECS/EKS, prefer an IAM role attached to the instance/task. Leave `AWS_ACCESS_KEY_ID` and `AWS_SECRET_ACCESS_KEY` empty — the AWS SDK will pick up instance credentials automatically.
- For local dev or environments without instance metadata, set `AWS_ACCESS_KEY_ID` and `AWS_SECRET_ACCESS_KEY` explicitly.

**Required IAM permissions:**
```json
{
  "Effect": "Allow",
  "Action": [
    "logs:CreateLogGroup",
    "logs:CreateLogStream",
    "logs:PutLogEvents"
  ],
  "Resource": "arn:aws:logs:*:*:log-group:/auto8/api:*"
}
```

**Log group / stream naming:**
- `CLOUDWATCH_LOG_GROUP` — the log group (e.g. `/auto8/api`, `/auto8/api/prod`)
- `CLOUDWATCH_LOG_STREAM` — the log stream. Defaults to `os.hostname()` if not set. For multi-instance deployments, set this to a unique value per instance (e.g. `$HOSTNAME`, `$ECS_CONTAINER_METADATA_URI` task ID).

---

### Datadog

Sends logs to the Datadog Logs intake API.

**Enable:**
```env
DATADOG_ENABLED=true
DD_API_KEY=your-datadog-api-key
DD_SERVICE=auto8
DD_ENV=production
DD_VERSION=1.2.3
```

**Unified service tagging:**
- `DD_SERVICE` — service name tag (default: `auto8`)
- `DD_ENV` — environment tag (default: `production`)
- `DD_VERSION` — version tag (optional, but recommended for deployment tracking)

These map to Datadog's [unified service tagging](https://docs.datadoghq.com/getting_started/tagging/unified_service_tagging/) convention.

---

### Loki (Grafana)

Sends logs to a Grafana Loki instance.

**Enable:**
```env
LOKI_ENABLED=true
LOKI_HOST=http://loki:3100
LOKI_USERNAME=
LOKI_PASSWORD=
```

**Basic auth:** If `LOKI_USERNAME` and `LOKI_PASSWORD` are both set, basic auth is used (required for Grafana Cloud Loki). Leave both empty for unauthenticated local Loki instances.

**Labels:** Logs are tagged with `{ app: 'auto8' }`. To add more labels, modify `buildLogTransports()` in `apps/api/src/logging/log-transports.ts`.

---

### New Relic

Sends logs to New Relic Logs.

**Enable:**
```env
NEW_RELIC_ENABLED=true
NEW_RELIC_LICENSE_KEY=your-license-key
NEW_RELIC_APP_NAME=auto8
```

**License key format:** New Relic license keys are 40 characters (e.g. `eu01xx...NRAL` for EU, `xxxxxxxx...NRAL` for US). Do not confuse with API keys (different format).

**App name:** `NEW_RELIC_APP_NAME` groups logs in the New Relic UI under the application name.

---

## Troubleshooting

### "Transport skipped" warnings on startup

If a transport is enabled (`CLOUDWATCH_ENABLED=true`) but required variables are missing, auto8 logs a `WARN` to stderr and continues — the service will start normally using stdout only:

```
[logging] WARN: CLOUDWATCH_ENABLED=true but required vars missing (...). CloudWatch transport skipped.
```

Fix by providing the required environment variables listed in the transport's section above.

### Worker thread errors

pino transports run in Node.js worker threads. If a transport package is missing or fails to load, pino will log an error like:

```
Error: Cannot find module 'pino-loki'
```

Ensure all 4 transport packages are installed:
```bash
npm install --workspace apps/api @serdnam/pino-cloudwatch-transport pino-datadog-transport pino-loki pino-new-relic
```

### Transport enabled but no logs appear in destination

1. Check that the required environment variables are all set and non-empty.
2. Check network connectivity from the API container to the logging service endpoint.
3. Set `LOG_LEVEL=debug` temporarily to increase verbosity.
4. For CloudWatch, verify IAM permissions include `logs:PutLogEvents`.

---

## Environment Variable Reference

| Variable | Default | Description |
|---|---|---|
| `LOG_LEVEL` | `info` | Minimum log level |
| `CLOUDWATCH_ENABLED` | `false` | Enable CloudWatch transport |
| `AWS_REGION` | `us-east-1` | AWS region for CloudWatch |
| `CLOUDWATCH_LOG_GROUP` | `/auto8/api` | CloudWatch log group name |
| `CLOUDWATCH_LOG_STREAM` | `os.hostname()` | CloudWatch log stream name |
| `AWS_ACCESS_KEY_ID` | — | AWS access key (optional if using IAM role) |
| `AWS_SECRET_ACCESS_KEY` | — | AWS secret key (optional if using IAM role) |
| `DATADOG_ENABLED` | `false` | Enable Datadog transport |
| `DD_API_KEY` | — | Datadog API key (required) |
| `DD_SERVICE` | `auto8` | Datadog service tag |
| `DD_ENV` | `production` | Datadog env tag |
| `DD_VERSION` | — | Datadog version tag (optional) |
| `LOKI_ENABLED` | `false` | Enable Loki transport |
| `LOKI_HOST` | `http://loki:3100` | Loki push endpoint |
| `LOKI_USERNAME` | — | Loki basic auth username (optional) |
| `LOKI_PASSWORD` | — | Loki basic auth password (optional) |
| `NEW_RELIC_ENABLED` | `false` | Enable New Relic transport |
| `NEW_RELIC_LICENSE_KEY` | — | New Relic license key (required) |
| `NEW_RELIC_APP_NAME` | `auto8` | New Relic application name |
