/*
  Warnings:

  - Added the required column `token0` to the `tokensPools` table without a default value. This is not possible if the table is not empty.
  - Added the required column `token1` to the `tokensPools` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "tokensPools" ADD COLUMN     "token0" TEXT NOT NULL,
ADD COLUMN     "token1" TEXT NOT NULL;
