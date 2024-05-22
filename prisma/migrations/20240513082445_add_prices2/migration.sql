-- CreateTable
CREATE TABLE "prices2" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "tokenId" TEXT NOT NULL,
    "price" TEXT NOT NULL,
    "blockNumber" INTEGER NOT NULL,

    CONSTRAINT "prices2_pkey" PRIMARY KEY ("id")
);
