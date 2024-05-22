/*
  Warnings:

  - You are about to drop the column `userId` on the `operations` table. All the data in the column will be lost.
  - You are about to drop the column `userId` on the `transactions` table. All the data in the column will be lost.
  - A unique constraint covering the columns `[traderId]` on the table `users` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `traderId` to the `operations` table without a default value. This is not possible if the table is not empty.
  - Added the required column `traderId` to the `transactions` table without a default value. This is not possible if the table is not empty.

*/
-- DropForeignKey
ALTER TABLE "operations" DROP CONSTRAINT "operations_userId_fkey";

-- DropForeignKey
ALTER TABLE "transactions" DROP CONSTRAINT "transactions_userId_fkey";

-- DropIndex
DROP INDEX "users_telegramId_key";

-- AlterTable
ALTER TABLE "operations" DROP COLUMN "userId",
ADD COLUMN     "isCompleted" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "traderId" UUID NOT NULL,
ALTER COLUMN "tpvBefore" DROP NOT NULL,
ALTER COLUMN "tpvAfter" DROP NOT NULL,
ALTER COLUMN "sharesBefore" DROP NOT NULL,
ALTER COLUMN "sharesBefore" SET DATA TYPE TEXT,
ALTER COLUMN "sharesAfter" DROP NOT NULL,
ALTER COLUMN "sharesAfter" SET DATA TYPE TEXT,
ALTER COLUMN "sharePrice" DROP NOT NULL,
ALTER COLUMN "sharePrice" SET DATA TYPE TEXT;

-- AlterTable
ALTER TABLE "prices" ALTER COLUMN "usdPrice" SET DATA TYPE TEXT;

-- AlterTable
ALTER TABLE "transactions" DROP COLUMN "userId",
ADD COLUMN     "traderId" UUID NOT NULL;

-- AlterTable
ALTER TABLE "users" ADD COLUMN     "traderId" UUID;

-- CreateTable
CREATE TABLE "traders" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "address" TEXT NOT NULL,
    "profitLoss" INTEGER,
    "tpv" INTEGER,
    "realizedPl" INTEGER,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "traders_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "traders_address_key" ON "traders"("address");

-- CreateIndex
CREATE UNIQUE INDEX "users_traderId_key" ON "users"("traderId");

-- AddForeignKey
ALTER TABLE "transactions" ADD CONSTRAINT "transactions_traderId_fkey" FOREIGN KEY ("traderId") REFERENCES "traders"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "operations" ADD CONSTRAINT "operations_traderId_fkey" FOREIGN KEY ("traderId") REFERENCES "traders"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "users" ADD CONSTRAINT "users_traderId_fkey" FOREIGN KEY ("traderId") REFERENCES "traders"("id") ON DELETE SET NULL ON UPDATE CASCADE;
