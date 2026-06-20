-- Add persisted clock phase for transition-based live minute calculation
ALTER TABLE "Partido"
ADD COLUMN "relojFase" INTEGER NOT NULL DEFAULT 0;
