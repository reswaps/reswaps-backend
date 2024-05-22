-- CreateTable
CREATE TABLE "tokensPools" (
    "id" TEXT NOT NULL,
    "poolId" TEXT NOT NULL,
    "isToken0" BOOLEAN NOT NULL,
    "decimal0" INTEGER NOT NULL,
    "decimal1" INTEGER NOT NULL,

    CONSTRAINT "tokensPools_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "tokensPools" ADD CONSTRAINT "tokensPools_id_fkey" FOREIGN KEY ("id") REFERENCES "tokens"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tokensPools" ADD CONSTRAINT "tokensPools_poolId_fkey" FOREIGN KEY ("poolId") REFERENCES "pools"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
