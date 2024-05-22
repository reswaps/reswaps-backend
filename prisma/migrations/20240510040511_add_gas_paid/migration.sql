/*
  Warnings:

  - Added the required column `gasPaid` to the `operations` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "operations" ADD COLUMN     "gasPaid" TEXT NOT NULL;
