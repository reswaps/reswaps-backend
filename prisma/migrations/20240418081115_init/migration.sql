CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- CreateTable
CREATE TABLE "transactions" (
    "id" TEXT NOT NULL,
    "blockNumber" INTEGER NOT NULL,
    "date" TIMESTAMPTZ(6) NOT NULL,
    "from" TEXT NOT NULL,
    "to" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "logs" JSONB[],

    CONSTRAINT "transactions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "operationTypes" (
    "id" TEXT NOT NULL,

    CONSTRAINT "operationTypes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "operations" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "typeId" TEXT NOT NULL,
    "txId" TEXT NOT NULL,
    "tokenIn" TEXT,
    "tokenOut" TEXT,
    "amountIn" TEXT,
    "amountOut" TEXT,
    "usdIn" INTEGER,
    "usdOut" INTEGER,
    "portfolio" JSONB NOT NULL,
    "tpvBefore" INTEGER NOT NULL,
    "tpvAfter" INTEGER NOT NULL,
    "sharesBefore" INTEGER NOT NULL,
    "sharesAfter" INTEGER NOT NULL,
    "sharePrice" INTEGER NOT NULL,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "operations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tokens" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "symbol" TEXT NOT NULL,
    "decimals" INTEGER NOT NULL,
    "logoUrl" TEXT,

    CONSTRAINT "tokens_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "prices" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "tokenId" TEXT NOT NULL,
    "date" TIMESTAMPTZ(6) NOT NULL,
    "blockNumber" INTEGER NOT NULL,
    "usdPrice" INTEGER NOT NULL,
    "dexName" TEXT,

    CONSTRAINT "prices_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pools" (
    "id" TEXT NOT NULL,
    "dexName" TEXT NOT NULL,
    "createdAtBlock" INTEGER NOT NULL,
    "updatedAtBlock" INTEGER,
    "tokenOneId" TEXT NOT NULL,
    "tokenTwoId" TEXT NOT NULL,

    CONSTRAINT "pools_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "operations" ADD CONSTRAINT "operations_typeId_fkey" FOREIGN KEY ("typeId") REFERENCES "operationTypes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "operations" ADD CONSTRAINT "operations_txId_fkey" FOREIGN KEY ("txId") REFERENCES "transactions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "prices" ADD CONSTRAINT "prices_tokenId_fkey" FOREIGN KEY ("tokenId") REFERENCES "tokens"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pools" ADD CONSTRAINT "pools_tokenOneId_fkey" FOREIGN KEY ("tokenOneId") REFERENCES "tokens"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pools" ADD CONSTRAINT "pools_tokenTwoId_fkey" FOREIGN KEY ("tokenTwoId") REFERENCES "tokens"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
