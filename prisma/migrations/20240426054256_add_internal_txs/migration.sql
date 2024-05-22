/*
  Warnings:

  - You are about to drop the column `category` on the `transactions` table. All the data in the column will be lost.
  - Made the column `sharesBefore` on table `operations` required. This step will fail if there are existing NULL values in that column.
  - Made the column `sharesAfter` on table `operations` required. This step will fail if there are existing NULL values in that column.
  - Made the column `sharePrice` on table `operations` required. This step will fail if there are existing NULL values in that column.

*/
-- AlterTable
ALTER TABLE "operations" ALTER COLUMN "sharesBefore" SET NOT NULL,
ALTER COLUMN "sharesAfter" SET NOT NULL,
ALTER COLUMN "sharePrice" SET NOT NULL;

-- AlterTable
ALTER TABLE "transactions" DROP COLUMN "category",
ADD COLUMN     "internalTxs" JSONB[];
