# proyecto-prode

App de prode con backend y frontend (monorepo).

- **Backend:** `prode-backend/` (Express + Prisma)
- **Frontend / Capacitor:** raíz del repo (`index.html`, `js/`, `pages/`)

## Deploy

See [DEPLOY.md](DEPLOY.md) for Azure App Service, Static Web Apps, and GitHub Actions setup.

## Tests

```bash
npm run test:frontend
npm --prefix prode-backend test
npm run test:all
```

Frontend functional tests use Playwright with mocked backend responses. Backend tests use `node:test`, Supertest, and mocked Prisma/football-data dependencies. GitHub Actions runs both suites in `.github/workflows/ci.yml`.
