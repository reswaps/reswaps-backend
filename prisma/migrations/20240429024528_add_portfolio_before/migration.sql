/*
  Warnings:

  - You are about to drop the column `portfolio` on the `operations` table. All the data in the column will be lost.
  - Added the required column `portfolioAfter` to the `operations` table without a default value. This is not possible if the table is not empty.
  - Added the required column `portfolioBefore` to the `operations` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "operations" DROP COLUMN "portfolio",
ADD COLUMN     "portfolioAfter" JSONB NOT NULL,
ADD COLUMN     "portfolioBefore" JSONB NOT NULL;
