-- AlterTable
ALTER TABLE "traders" ADD COLUMN     "realizedPnlPercentage" INTEGER,
ADD COLUMN     "sharePrice" INTEGER,
ADD COLUMN     "shares" TEXT,
ADD COLUMN     "unrealizedPnlPercentage" INTEGER,
ADD COLUMN     "wapBuy" INTEGER,
ADD COLUMN     "wapSell" INTEGER;
