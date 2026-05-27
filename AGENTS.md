# auto8 — Agent Instructions

## Project overview

TypeScript monorepo with three workspaces:
- `apps/api` — NestJS REST API with Prisma ORM
- `apps/web` — React/Next.js frontend
- `packages/shared` — shared types, utilities, constants

## Key commands

```bash
npm run dev          # start api + web concurrently
npm run build        # build all workspaces in order
npm run test         # run api tests
npm run typecheck    # typecheck all workspaces
npm run db:generate  # prisma generate
npm run db:migrate   # prisma migrate dev
npm run db:seed      # seed database
```

## Conventions

- **TypeScript strict mode** is enabled — no `any`, prefer explicit types
- **NestJS** — use decorators, DI, Guards/Interceptors/Pipes patterns
- **Prisma** — all DB access goes through `PrismaService`; never raw SQL unless necessary
- **Shared types** — define shared interfaces/enums in `packages/shared`, import in both apps
- **Imports** — use workspace aliases (`@auto8/shared`) not relative paths across packages
- **Tests** — Jest with `*.spec.ts` naming, colocated with source files in `apps/api`
- **Env vars** — always add new vars to `.env.example`; never commit secrets

## File structure

```
apps/
  api/
    src/
      modules/      # feature modules (NestJS)
      common/       # guards, interceptors, pipes, decorators
    prisma/
      schema.prisma
      migrations/
      seed.ts
  web/
    src/
      app/          # Next.js app router pages
      components/   # React components
      lib/          # utilities, API clients
packages/
  shared/
    src/
      types/
      constants/
```

## Before committing

1. Run `npm run typecheck` — fix all errors
2. Run `npm run build` — ensure everything compiles
3. Run `npm run test` — all tests pass
4. No secrets or `.env` files staged
