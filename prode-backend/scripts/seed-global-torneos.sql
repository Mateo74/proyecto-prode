-- ============================================================
-- Once Metros Global Torneos — Seed Script
-- Safe to re-run: the INSERT uses ON CONFLICT ... DO UPDATE.
--
-- Prerequisites (already applied via Prisma migration
--   20260604022448_add_es_global_e_imagen_torneo):
--   • "TorneoDeAmigos"."esGlobal" BOOLEAN NOT NULL DEFAULT false
--   • "TorneoDeAmigos"."imagen"   TEXT
-- ============================================================

-- 1. Filtered unique index: only one global torneo per competencia.
--    Prisma can't express partial indexes natively, so we add it here.
--    IF NOT EXISTS makes this safe to re-run.
CREATE UNIQUE INDEX IF NOT EXISTS "TorneoDeAmigos_global_competencia_unique"
  ON "TorneoDeAmigos" ("competenciaId")
  WHERE "esGlobal" = true;

-- 2. Upsert one "Once Metros" global torneo per competencia.
--    • creadorId   = NULL — no owner
--    • inviteToken = NULL — not joinable via invite link
--    • imagen      = NULL — set to Once Metros logo URL when ready, e.g.:
--                          'https://www.oncemetros.com/assets/icons/icon-192.png'
--
--    ON CONFLICT: if a global torneo for this competencia already exists,
--    refresh the name and timestamp only (preserves any manual imagen changes).
INSERT INTO "TorneoDeAmigos"
  (id, nombre, "competenciaId", "creadorId", "inviteToken", "esGlobal", activo, imagen, "fechaCreacion", "fechaActualizacion")
SELECT
  gen_random_uuid()::text   AS id,
  'Once Metros'             AS nombre,
  c.id                      AS "competenciaId",
  NULL                      AS "creadorId",
  NULL                      AS "inviteToken",
  true                      AS "esGlobal",
  true                      AS activo,
  NULL                      AS imagen,
  NOW()                     AS "fechaCreacion",
  NOW()                     AS "fechaActualizacion"
FROM "Competencia" c
ON CONFLICT ("competenciaId") WHERE "esGlobal" = true
DO UPDATE SET
  nombre               = EXCLUDED.nombre,
  "fechaActualizacion" = NOW();

-- 3. Verify — shows the created global torneos joined with their competition
SELECT
  t.id,
  t.nombre                AS torneo,
  c.nombre                AS competencia,
  c.visible,
  t."esGlobal",
  t.activo,
  t.imagen,
  t."fechaCreacion"
FROM "TorneoDeAmigos" t
JOIN "Competencia" c ON c.id = t."competenciaId"
WHERE t."esGlobal" = true
ORDER BY c.nombre;
