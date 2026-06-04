# Deploy Report: auto8 → Z440

**Date:** 2026-06-03
**Server:** 10.113.213.9 (Z440, localhost)
**Branch:** main (rebased from x51-commit/20260531-000000-billing-toggle-plugin-arch)
**Commit:** 51b9b8b feat(ui): responsive mobile layout + i18n zh locale

## Summary

| Step | Status | Notes |
|------|--------|-------|
| Git commit | ✅ | Staged responsive UI + i18n zh changes, committed |
| Push to main | ✅ | Rebased local main onto origin/main (PR #12 merge), pushed |
| docker compose build | ✅ | api + web images rebuilt from source |
| docker compose up -d | ✅ | api-1 + web-1 recreated; postgres unchanged |
| Smoke test — API | ✅ | GET http://localhost:3001/api/health → {"ok":true} |
| Smoke test — Web | ✅ | GET http://localhost:3002/ → HTTP 307 (redirect to /rfqs) |

## What Was Deployed

- **feat(ui): responsive mobile layout** — overflow-x-hidden on html/body, hamburger sidebar drawer in app-shell, overflow-x-auto on all data tables, detail-drawer full-width on mobile, portal page fluid + stacked buttons, all app pages switched to responsive grid breakpoints
- **feat(i18n): zh locale** — apps/api/src/i18n/zh/common.json + apps/web/messages/zh.json (Simplified Chinese)
- **feat(ui): modern enterprise UI + quote-templates + customer onboarding flow** (054fc37)
- **fix(migration): mvp3 Workspace table** (d004931)
- **fix(plugin-registry): circular dep** (8ae71c5)

## Issues Encountered

- `git push origin main` rejected (non-fast-forward) — remote had PR #12 merge commit. Resolved with `git pull --rebase origin main`.
- SSH to 10.113.213.9 not needed — machine IS Z440. Ran `make deploy` locally.

## Test Results

- `GET http://localhost:3001/api/health` → `{"ok":true}` ✅
- `GET http://localhost:3002/` → `307` (redirect to /rfqs) ✅
