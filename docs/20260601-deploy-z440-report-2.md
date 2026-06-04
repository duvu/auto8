# Deploy Report: auto8 → Z440

**Date:** 2026-06-01
**Tag:** 20260601.2042
**Server:** 10.113.213.9

## Summary

| Step | Status | Notes |
|------|--------|-------|
| Project validation | ✅ | docker-compose.yml valid, Dockerfile + Dockerfile.web present |
| Docker build & push | ✅ | Built locally; registry docker.x51.vn down — used docker save + scp workaround |
| Image load on Z440 | ✅ | Both images loaded via ssh docker load |
| .env update | ✅ | AUTO8_API_IMAGE + AUTO8_WEB_IMAGE updated on Z440 (.env gitignored, no commit needed) |
| Container recreate | ✅ | auto8-api + auto8-web recreated via docker compose up -d --force-recreate |
| Smoke test | ✅ | GET /api/health → {"ok":true}, web HTTP 307 (redirect to /rfqs) |

## Issues Encountered & Fixes Applied

1. **Registry docker.x51.vn unreachable** — same as previous deploy. Used `docker save | gzip > tar.gz` then `scp` to Z440, then `docker load`.
2. **.env gitignored in deployment repo** — expected; tag is persisted directly on Z440's `.env` file.

## What Was Deployed

- **feat(ui)**: Modern enterprise UI overhaul — AppShell (dark sidebar), 5 new components (DataTable, DetailDrawer, StatusBadge, SummaryCards, QuoteTemplateForm), WorkspaceShell deleted, 20+ pages migrated
- **Route fix**: / → redirect to /rfqs; /rfqs is canonical RFQ dashboard
- **Quote templates**: PaginatedResponse fix, workspace scoping, @Roles admin, duplicate endpoint
- **Customer onboarding**: Setup nav link in AppShell ADMIN_NAV
- **Plugin registry**: circular dep fix, class-ref serviceToken, DI token manifests

## Test Results

- `GET http://10.113.213.9:8019/api/health` → `{"ok":true}` ✅
- `GET http://10.113.213.9:3020/` → `HTTP 307` (redirect to /rfqs) ✅
