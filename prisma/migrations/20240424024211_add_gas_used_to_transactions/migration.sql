/*
  Warnings:

  - Added the required column `effectiveGasPrice` to the `transactions` table without a default value. This is not possible if the table is not empty.
  - Added the required column `gasUsed` to the `transactions` table without a default value. This is not possible if the table is not empty.
  - Added the required column `logsBloom` to the `transactions` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "transactions" ADD COLUMN     "effectiveGasPrice" TEXT NOT NULL,
ADD COLUMN     "gasUsed" TEXT NOT NULL,
ADD COLUMN     "logsBloom" TEXT NOT NULL;
