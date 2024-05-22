/*
  Warnings:

  - Changed the type of `txId` on the `operations` table. No cast exists, the column would be dropped and recreated, which cannot be done if there is data, since the column is required.

*/
-- AlterTable
ALTER TABLE "operations" DROP COLUMN "txId",
ADD COLUMN     "txId" UUID NOT NULL;

-- AddForeignKey
ALTER TABLE "operations" ADD CONSTRAINT "operations_txId_fkey" FOREIGN KEY ("txId") REFERENCES "transactions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
