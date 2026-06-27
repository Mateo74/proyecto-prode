-- Persist the provider knockout stage on each match (GROUP_STAGE, LAST_32, ...).
-- The bracket skeleton is fabricated client-side; only complete matches are stored.
ALTER TABLE "Partido"
ADD COLUMN "etapa" TEXT;
