# Deploy Report: auto8 → Z440

**Date:** 2026-06-01
**Tag:** 20260601.1050
**Server:** 10.113.213.9

## Summary

| Step | Status | Notes |
|------|--------|-------|
| Project validation | ✅ | docker-compose.yml valid, auto8-api + auto8-web services present |
| Docker build | ✅ | api:20260601.1050 (353M), web:20260601.1050 (426M) |
| Registry push | ⚠️ | docker.x51.vn (10.113.213.4) was unreachable — used scp+load workaround |
| Deployment update | ✅ | .env on Z440 updated to new tag |
| Container recreate | ✅ | auto8-api and auto8-web recreated successfully |
| Smoke test | ✅ | API /api/health → 200, web / → 307 (redirect to /rfqs) |

## Changes in this deploy

- fix-rfqs-route: `/rfqs` route now works (moved RFQ dashboard from root to `/rfqs`, root redirects)
- sidebar-contrast: improved WCAG AA contrast in dark sidebar
- modern-enterprise-ui: new AppShell, design tokens, status badges, summary cards

## Issues Encountered & Fixes Applied

- **Registry unreachable**: `docker.x51.vn` (10.113.213.4) was down (100% packet loss). Worked around by:
  1. `docker save | gzip > /tmp/*.tar.gz`
  2. `scp` to Z440
  3. `docker load` on Z440
  4. Updated `.env` on Z440 directly

## Test Results

- `GET http://10.113.213.9:8019/api/health` → `{"ok":true}` ✅
- `GET http://10.113.213.9:3020/` → 307 redirect to `/rfqs` ✅
