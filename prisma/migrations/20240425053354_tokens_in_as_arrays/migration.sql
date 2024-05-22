/*
  Warnings:

  - You are about to drop the column `amountIn` on the `operations` table. All the data in the column will be lost.
  - You are about to drop the column `amountOut` on the `operations` table. All the data in the column will be lost.
  - You are about to drop the column `tokenIn` on the `operations` table. All the data in the column will be lost.
  - You are about to drop the column `tokenOut` on the `operations` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "operations" DROP COLUMN "amountIn",
DROP COLUMN "amountOut",
DROP COLUMN "tokenIn",
DROP COLUMN "tokenOut",
ADD COLUMN     "amountsIn" TEXT[],
ADD COLUMN     "amountsOut" TEXT[],
ADD COLUMN     "tokensIn" TEXT[],
ADD COLUMN     "tokensOut" TEXT[];
