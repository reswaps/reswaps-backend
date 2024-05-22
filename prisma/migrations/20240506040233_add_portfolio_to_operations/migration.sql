/*
  Warnings:

  - You are about to drop the column `portfolioAfter` on the `operations` table. All the data in the column will be lost.
  - You are about to drop the column `portfolioBefore` on the `operations` table. All the data in the column will be lost.
  - Added the required column `portfolio` to the `operations` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "operations" DROP COLUMN "portfolioAfter",
DROP COLUMN "portfolioBefore",
ADD COLUMN     "portfolio" JSONB NOT NULL;
