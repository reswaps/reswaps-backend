/*
  Warnings:

  - You are about to drop the column `profitLoss` on the `traders` table. All the data in the column will be lost.
  - You are about to drop the column `realizedPl` on the `traders` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "traders" DROP COLUMN "profitLoss",
DROP COLUMN "realizedPl",
ADD COLUMN     "realizedPnl" TEXT,
ADD COLUMN     "unrealizedPnl" TEXT,
ALTER COLUMN "tpv" SET DATA TYPE TEXT;
