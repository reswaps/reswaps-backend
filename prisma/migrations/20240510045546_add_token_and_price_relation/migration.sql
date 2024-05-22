/*
  Warnings:

  - You are about to drop the column `date` on the `prices` table. All the data in the column will be lost.
  - You are about to drop the column `token` on the `prices` table. All the data in the column will be lost.
  - Added the required column `tokenId` to the `prices` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "prices" DROP COLUMN "date",
DROP COLUMN "token",
ADD COLUMN     "tokenId" TEXT NOT NULL;

-- AddForeignKey
ALTER TABLE "prices" ADD CONSTRAINT "prices_tokenId_fkey" FOREIGN KEY ("tokenId") REFERENCES "tokens"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
