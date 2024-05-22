/*
  Warnings:

  - Added the required column `blockNumber` to the `operations` table without a default value. This is not possible if the table is not empty.
  - Added the required column `transactionIndex` to the `operations` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "operations" ADD COLUMN     "blockNumber" INTEGER NOT NULL,
ADD COLUMN     "transactionIndex" INTEGER NOT NULL;
