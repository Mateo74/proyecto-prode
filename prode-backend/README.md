# Prode backend

Backend Express + Prisma para la app de predicciones.

## Configuracion local

1. Copiar `.env.example` a `.env`.
2. Completar `DATABASE_URL` apuntando a `prode_dev` en Azure PostgreSQL.
3. Para login con Google, completar `GOOGLE_CLIENT_ID` con el OAuth Client ID web de Google Cloud.
4. Correr:

```bash
npm install
npm run prisma:generate
npm run prisma:migrate
npm run seed
npm run dev
```

La URL de Azure debe terminar con `?sslmode=require`.

## Google auth

El frontend usa Google Identity Services y envia el ID token a `POST /api/auth/google`.
Configurar el mismo OAuth Client ID en:

- `prode-backend/.env` como `GOOGLE_CLIENT_ID`
- `js/config.js` como `GOOGLE_CLIENT_ID`

En Google Cloud Console, agregar el origen local que uses para abrir la app, por ejemplo `http://localhost:8080`, y en produccion el dominio de Azure Static Web Apps.

## Deploy a Azure

Ver [DEPLOY.md](../DEPLOY.md) en la raiz del monorepo (App Service + Static Web Apps + GitHub Actions).

## Tests

```bash
npm test
```

La suite usa `node:test`. Los tests funcionales mockean Prisma y respuestas de football-data para evitar depender de una base real o de la API externa en CI.

## Telemetria

- `GET /health` expone un health-check liviano.
- `GET /metrics` expone metricas Prometheus de requests, latencia e in-flight requests.
- Para Azure Application Insights, configurar `APPLICATIONINSIGHTS_CONNECTION_STRING` en App Service. Opcionalmente usar `APPLICATIONINSIGHTS_SAMPLING_RATIO` para reducir volumen.

## Endpoints principales

- `GET /api/partidos`
- `GET /api/partidos/:id`
- `POST /api/predicciones`
- `GET /api/predicciones/me`
- `GET /api/clasificacion`
- `POST /api/partidos/:id/cerrar`

Para probar con un usuario especifico, enviar header `x-user-id`. Sin ese header, la API usa el primer usuario activo de la base.

## Cerrar partido

```http
POST /api/partidos/:id/cerrar
Content-Type: application/json

{
  "golesEquipo1": 2,
  "golesEquipo2": 1
}
```

El cierre es idempotente si se repite con el mismo resultado. Si el partido ya fue cerrado con otro resultado, responde `409`.
