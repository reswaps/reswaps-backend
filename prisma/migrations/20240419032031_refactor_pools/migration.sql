/*
  Warnings:

  - You are about to drop the column `tokenOneId` on the `pools` table. All the data in the column will be lost.
  - You are about to drop the column `tokenTwoId` on the `pools` table. All the data in the column will be lost.
  - Added the required column `token0` to the `pools` table without a default value. This is not possible if the table is not empty.
  - Added the required column `token1` to the `pools` table without a default value. This is not possible if the table is not empty.

*/
-- DropForeignKey
ALTER TABLE "pools" DROP CONSTRAINT "pools_tokenOneId_fkey";

-- DropForeignKey
ALTER TABLE "pools" DROP CONSTRAINT "pools_tokenTwoId_fkey";

-- AlterTable
ALTER TABLE "pools" DROP COLUMN "tokenOneId",
DROP COLUMN "tokenTwoId",
ADD COLUMN     "token0" TEXT NOT NULL,
ADD COLUMN     "token1" TEXT NOT NULL;
