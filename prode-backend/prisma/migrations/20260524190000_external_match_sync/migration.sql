-- Datos externos de fixtures/resultados. Los IDs externos nunca reemplazan los IDs internos.
ALTER TABLE "Competencia"
ADD COLUMN "externalId" TEXT,
ADD COLUMN "proveedor" TEXT,
ADD COLUMN "visible" BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE "Equipo"
ADD COLUMN "externalId" TEXT,
ADD COLUMN "proveedor" TEXT,
ADD COLUMN "escudoUrl" TEXT;

ALTER TABLE "Partido"
ADD COLUMN "externalId" TEXT,
ADD COLUMN "proveedor" TEXT,
ADD COLUMN "minutoActual" INTEGER,
ADD COLUMN "fechaInicioReal" TIMESTAMP(3),
ADD COLUMN "ultimaSyncExterna" TIMESTAMP(3),
ADD COLUMN "ultimaActualizacionEstado" TIMESTAMP(3),
ADD COLUMN "resultadoConfirmado" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN "confirmacionesResultado" INTEGER NOT NULL DEFAULT 0;

CREATE UNIQUE INDEX "Competencia_proveedor_externalId_key" ON "Competencia"("proveedor", "externalId");
CREATE INDEX "Competencia_visible_idx" ON "Competencia"("visible");

CREATE UNIQUE INDEX "Equipo_proveedor_externalId_key" ON "Equipo"("proveedor", "externalId");

CREATE UNIQUE INDEX "Partido_proveedor_externalId_key" ON "Partido"("proveedor", "externalId");
