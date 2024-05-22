/*
  Warnings:

  - You are about to drop the column `gasPaid` on the `operations` table. All the data in the column will be lost.
  - You are about to drop the column `sharePrice` on the `operations` table. All the data in the column will be lost.
  - You are about to drop the column `shares` on the `operations` table. All the data in the column will be lost.
  - You are about to drop the column `sharesBurned` on the `operations` table. All the data in the column will be lost.
  - You are about to drop the column `sharesIssued` on the `operations` table. All the data in the column will be lost.
  - You are about to drop the column `tpv` on the `operations` table. All the data in the column will be lost.
  - You are about to drop the column `transfersIn` on the `operations` table. All the data in the column will be lost.
  - You are about to drop the column `transfersOut` on the `operations` table. All the data in the column will be lost.
  - You are about to drop the column `typeId` on the `operations` table. All the data in the column will be lost.
  - You are about to drop the column `usdIn` on the `operations` table. All the data in the column will be lost.
  - You are about to drop the column `usdOut` on the `operations` table. All the data in the column will be lost.
  - Added the required column `operationType` to the `operations` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "operations" DROP COLUMN "gasPaid",
DROP COLUMN "sharePrice",
DROP COLUMN "shares",
DROP COLUMN "sharesBurned",
DROP COLUMN "sharesIssued",
DROP COLUMN "tpv",
DROP COLUMN "transfersIn",
DROP COLUMN "transfersOut",
DROP COLUMN "typeId",
DROP COLUMN "usdIn",
DROP COLUMN "usdOut",
ADD COLUMN     "operationType" TEXT NOT NULL,
ADD COLUMN     "transfers" JSONB[];

-- CreateTable
CREATE TABLE "prices" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "token" TEXT NOT NULL,
    "date" TIMESTAMPTZ(6) NOT NULL,
    "price" INTEGER NOT NULL,
    "blockNumber" INTEGER NOT NULL,

    CONSTRAINT "prices_pkey" PRIMARY KEY ("id")
);
