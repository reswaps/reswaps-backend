/*
  Warnings:

  - A unique constraint covering the columns `[tokenId,blockNumber]` on the table `prices` will be added. If there are existing duplicate values, this will fail.

*/
-- CreateIndex
CREATE UNIQUE INDEX "tokenBlockNumberUnique" ON "prices"("tokenId", "blockNumber");
