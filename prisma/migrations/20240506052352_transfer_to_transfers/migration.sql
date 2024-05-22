/*
  Warnings:

  - You are about to drop the column `transferIn` on the `operations` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "operations" DROP COLUMN "transferIn",
ADD COLUMN     "transfersIn" JSONB[];
