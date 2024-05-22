/*
  Warnings:

  - The `realizedPnl` column on the `traders` table would be dropped and recreated. This will lead to data loss if there is data in the column.
  - The `unrealizedPnl` column on the `traders` table would be dropped and recreated. This will lead to data loss if there is data in the column.
  - You are about to drop the column `effectiveGasPrice` on the `transactions` table. All the data in the column will be lost.
  - You are about to drop the column `logsBloom` on the `transactions` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "traders" DROP COLUMN "realizedPnl",
ADD COLUMN     "realizedPnl" BIGINT,
DROP COLUMN "unrealizedPnl",
ADD COLUMN     "unrealizedPnl" BIGINT,
ALTER COLUMN "sharePrice" SET DATA TYPE TEXT,
ALTER COLUMN "wapBuy" SET DATA TYPE TEXT,
ALTER COLUMN "wapSell" SET DATA TYPE TEXT;

-- AlterTable
ALTER TABLE "transactions" DROP COLUMN "effectiveGasPrice",
DROP COLUMN "logsBloom";
