/*
  Warnings:

  - A unique constraint covering the columns `[txId]` on the table `operations` will be added. If there are existing duplicate values, this will fail.

*/
-- CreateIndex
CREATE UNIQUE INDEX "operations_txId_key" ON "operations"("txId");
