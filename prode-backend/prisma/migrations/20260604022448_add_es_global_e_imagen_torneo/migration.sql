-- AlterTable
ALTER TABLE "TorneoDeAmigos" ADD COLUMN     "esGlobal" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "imagen" TEXT;

-- CreateIndex
CREATE INDEX "TorneoDeAmigos_esGlobal_idx" ON "TorneoDeAmigos"("esGlobal");
