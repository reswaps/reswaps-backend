/*
  Warnings:

  - You are about to drop the `operationTypes` table. If the table is not empty, all the data it contains will be lost.
  - Added the required column `gasPaid` to the `operations` table without a default value. This is not possible if the table is not empty.

*/
-- DropForeignKey
ALTER TABLE "operations" DROP CONSTRAINT "operations_typeId_fkey";

-- AlterTable
ALTER TABLE "operations" ADD COLUMN     "gasPaid" TEXT NOT NULL;

-- DropTable
DROP TABLE "operationTypes";
