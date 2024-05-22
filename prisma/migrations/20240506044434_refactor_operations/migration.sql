/*
  Warnings:

  - You are about to drop the column `amountsIn` on the `operations` table. All the data in the column will be lost.
  - You are about to drop the column `amountsOut` on the `operations` table. All the data in the column will be lost.
  - You are about to drop the column `sharesAfter` on the `operations` table. All the data in the column will be lost.
  - You are about to drop the column `sharesBefore` on the `operations` table. All the data in the column will be lost.
  - You are about to drop the column `tokensIn` on the `operations` table. All the data in the column will be lost.
  - You are about to drop the column `tokensOut` on the `operations` table. All the data in the column will be lost.
  - You are about to drop the column `tpvAfter` on the `operations` table. All the data in the column will be lost.
  - You are about to drop the column `tpvBefore` on the `operations` table. All the data in the column will be lost.
  - Added the required column `shares` to the `operations` table without a default value. This is not possible if the table is not empty.
  - Added the required column `sharesBurned` to the `operations` table without a default value. This is not possible if the table is not empty.
  - Added the required column `sharesIssued` to the `operations` table without a default value. This is not possible if the table is not empty.
  - Added the required column `tpv` to the `operations` table without a default value. This is not possible if the table is not empty.
  - Made the column `usdIn` on table `operations` required. This step will fail if there are existing NULL values in that column.
  - Made the column `usdOut` on table `operations` required. This step will fail if there are existing NULL values in that column.

*/
-- AlterTable
ALTER TABLE "operations" DROP COLUMN "amountsIn",
DROP COLUMN "amountsOut",
DROP COLUMN "sharesAfter",
DROP COLUMN "sharesBefore",
DROP COLUMN "tokensIn",
DROP COLUMN "tokensOut",
DROP COLUMN "tpvAfter",
DROP COLUMN "tpvBefore",
ADD COLUMN     "shares" TEXT NOT NULL,
ADD COLUMN     "sharesBurned" TEXT NOT NULL,
ADD COLUMN     "sharesIssued" TEXT NOT NULL,
ADD COLUMN     "tpv" TEXT NOT NULL,
ADD COLUMN     "transferIn" JSONB[],
ADD COLUMN     "transfersOut" JSONB[],
ALTER COLUMN "usdIn" SET NOT NULL,
ALTER COLUMN "usdIn" SET DATA TYPE TEXT,
ALTER COLUMN "usdOut" SET NOT NULL,
ALTER COLUMN "usdOut" SET DATA TYPE TEXT;
