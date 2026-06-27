-- Knockout fixtures: persist the provider stage (GROUP_STAGE, LAST_32, ...) and
-- allow undefined teams so we can store "locked" fixtures whose slots aren't decided yet.
ALTER TABLE "Partido"
ADD COLUMN "etapa" TEXT;

ALTER TABLE "Partido"
ALTER COLUMN "equipo1Id" DROP NOT NULL,
ALTER COLUMN "equipo2Id" DROP NOT NULL;
