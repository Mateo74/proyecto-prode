/*
  Warnings:

  - You are about to drop the `PushSubscription` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE "PushSubscription" DROP CONSTRAINT "PushSubscription_usuarioId_fkey";

-- DropTable
DROP TABLE "PushSubscription";

-- CreateTable
CREATE TABLE "ExpoToken" (
    "id" TEXT NOT NULL,
    "usuarioId" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ExpoToken_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ExpoToken_usuarioId_idx" ON "ExpoToken"("usuarioId");

-- CreateIndex
CREATE UNIQUE INDEX "ExpoToken_usuarioId_token_key" ON "ExpoToken"("usuarioId", "token");

-- AddForeignKey
ALTER TABLE "ExpoToken" ADD CONSTRAINT "ExpoToken_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "Usuario"("id") ON DELETE CASCADE ON UPDATE CASCADE;
