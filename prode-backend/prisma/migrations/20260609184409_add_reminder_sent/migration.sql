-- CreateTable
CREATE TABLE "ReminderSent" (
    "id" TEXT NOT NULL,
    "usuarioId" TEXT NOT NULL,
    "partidoId" TEXT NOT NULL,
    "horasAntes" INTEGER NOT NULL,
    "sentAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ReminderSent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ReminderSent_sentAt_idx" ON "ReminderSent"("sentAt");

-- CreateIndex
CREATE UNIQUE INDEX "ReminderSent_usuarioId_partidoId_horasAntes_key" ON "ReminderSent"("usuarioId", "partidoId", "horasAntes");
