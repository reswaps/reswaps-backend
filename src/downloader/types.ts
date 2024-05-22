import { Prisma } from '@prisma/client';

export interface RawTransfer {
  type: 'IN' | 'OUT';
  token: string;
  amount: string;
  isFee?: true | undefined;
}

export interface Transfer extends RawTransfer {
  decimals: number;
}

export interface Portfolio {
  [token: string]: {
    amount: string;
    decimals: number;
  };
}

export interface PricedPortfolio {
  [token: string]: {
    amount: string;
    decimals: number;
    price: number;
    value: number;
  };
}

export interface HistoricalPriceRequests {
  [blockNumber: number]: TokensPool[];
}

export interface TokensMap {
  [token: string]: Omit<Prisma.tokensGetPayload<any>, 'id'>;
}

export interface PriceAndBlock {
  blockNumber: number;
  price: string;
}

export interface PriceMap {
  [token: string]: PriceAndBlock[];
}

export interface TokensPool {
  id: string;
  token0: string;
  token1: string;
  decimal0: number;
  decimal1: number;
  poolId: string;
  dexName: string;
}

export interface HistoricalPrice {
  blockNumber: number;
  tokenId: string;
  price: string;
}

export interface PriceRequest {
  fromBlock: string;
  toBlock: string;
  targetBlock: number;
  token: string;
  pool: Pool;
}

export interface Pool {
  poolAddr: string;
  token0: string;
  token1: string;
  dexName: string;
  decimals0: number;
  decimals1: number;
}

export interface TokensToPool {
  [token: string]: Pool;
}
