import { Injectable, Logger } from '@nestjs/common';
import { ethers } from 'ethers-v6';
import univ3prices from '@thanpolas/univ3prices';
import { DEX, NATIVE, OPERATIONS } from 'src/constants/names';
import analysis_abi from '../constants/abi/analysis.json';
import { Prisma } from '@prisma/client';
import {
  HistoricalPrice,
  Portfolio,
  PriceAndBlock,
  RawTransfer,
  TokensMap,
  Transfer,
} from 'src/downloader/types';
import { CONFIG } from 'src/constants/config';

@Injectable()
export class ParserService {
  private readonly logger = new Logger(ParserService.name);

  parseTransactionToTransfers(
    tx: Prisma.transactionsGetPayload<any>,
    traderAddress: string,
    targetTokens: TokensMap,
  ): Transfer[] {
    const Interface = new ethers.Interface(analysis_abi);

    const parsedLogs = tx.logs.map((log: any) => {
      if (Object.keys(log).length === 0) {
        return null;
      }
      try {
        return {
          address: log.address,
          logIndex: log.logIndex,
          parsedLog: Interface.parseLog(log),
        };
      } catch (e) {
        return null;
      }
    });

    const transfers: Transfer[] = [];
    const isTxFrom = tx.from === traderAddress;
    const isTxTo = tx.to === traderAddress;

    if (isTxFrom) {
      const gas = ethers.getBigInt(tx.gasUsed);

      if (gas > 0) {
        transfers.push({
          token: NATIVE,
          amount: gas.toString(),
          type: 'OUT',
          isFee: true,
          decimals: 18,
        });
      }
    }

    if (!tx.isFailed) {
      if (isTxTo && tx.value !== '0') {
        transfers.push({
          token: NATIVE,
          amount: tx.value,
          type: 'IN',
          decimals: 18,
        });
      }

      if (isTxFrom && tx.value !== '0') {
        transfers.push({
          token: NATIVE,
          amount: tx.value,
          type: 'OUT',
          decimals: 18,
        });
      }

      for (const internalTx of tx.internalTxs) {
        const iTx = internalTx as any;
        const isInternalTxFrom = iTx.from === traderAddress;
        const isInternalTxTo = iTx.to === traderAddress;
        if (isInternalTxFrom && iTx.value !== '0') {
          transfers.push({
            token: NATIVE,
            amount: iTx.value,
            type: 'OUT',
            decimals: 18,
          });
        }

        if (isInternalTxTo && iTx.value !== '0') {
          transfers.push({
            token: NATIVE,
            amount: iTx.value,
            type: 'IN',
            decimals: 18,
          });
        }
      }

      for (const log of parsedLogs) {
        if (log && log.parsedLog) {
          const { address } = log;
          const addr = address.toLowerCase();
          const { name, args } = log.parsedLog;
          const decimals = targetTokens[addr]?.decimals;

          if (decimals) {
            if (name === 'Transfer') {
              const [from, to, value] = args;
              if (from.toLowerCase() === traderAddress) {
                transfers.push({
                  token: addr,
                  amount: value.toString(),
                  type: 'OUT',
                  decimals,
                });
              }

              if (to.toLowerCase() === traderAddress) {
                transfers.push({
                  token: addr,
                  amount: value.toString(),
                  type: 'IN',
                  decimals,
                });
              }
            } else if (name === 'Deposit' && tx.to === CONFIG.weth) {
              const [dst, wad] = args;
              if (dst.toLowerCase() === traderAddress) {
                transfers.push({
                  token: CONFIG.weth,
                  amount: wad.toString(),
                  type: 'IN',
                  decimals: 18,
                });
              }
            } else if (name === 'Withdrawal' && tx.to === CONFIG.weth) {
              const [src, was] = args;
              if (src.toLowerCase() === traderAddress) {
                transfers.push({
                  token: CONFIG.weth,
                  amount: was.toString(),
                  type: 'OUT',
                  decimals: 18,
                });
              }
            }
          }
        }
      }
    }

    return transfers;
  }

  parseTransfersToPortfolio(
    transfers: Transfer[],
    prevPortfolio: Portfolio,
  ): Portfolio {
    const portfolio = { ...prevPortfolio };

    for (const { token, type, amount, decimals } of transfers) {
      if (type === 'IN') {
        if (portfolio[token]) {
          portfolio[token] = {
            amount: (
              ethers.getBigInt(portfolio[token].amount) +
              ethers.getBigInt(amount)
            ).toString(),
            decimals,
          };
        } else {
          portfolio[token] = {
            amount,
            decimals,
          };
        }
      } else if (type === 'OUT') {
        if (portfolio[token]) {
          portfolio[token] = {
            amount: (
              ethers.getBigInt(portfolio[token].amount) -
              ethers.getBigInt(amount)
            ).toString(),
            decimals,
          };
        } else {
          portfolio[token] = {
            amount: '-' + amount,
            decimals,
          };
        }

        if (token !== NATIVE && portfolio[token].amount.includes('-')) {
          portfolio[token].amount = '0';
        }
      }
    }

    for (const token in portfolio) {
      if (parseFloat(portfolio[token].amount) < 0) {
        console.log(portfolio, 'portfolio');
        console.log(prevPortfolio, 'prevPortfolio');
        console.log(transfers, 'transfers');
        throw Error('Negative balance');
      } else if (portfolio[token].amount === '0') {
        delete portfolio[token];
      }
    }

    return portfolio;
  }

  getTokensMap(tokens: Prisma.tokensGetPayload<any>[]): TokensMap {
    const tokenMap: TokensMap = {};

    for (const { id, ...rest } of tokens) {
      tokenMap[id] = rest;
    }

    return tokenMap;
  }

  getTargetToken(pool: { token0: string; token1: string }): string {
    const isUsdPool = this.isUsdPool(pool);
    let targetToken = '';

    if (isUsdPool) {
      targetToken = CONFIG.usdTokens.includes(pool.token0)
        ? pool.token1
        : pool.token0;
    } else {
      targetToken = pool.token0 === CONFIG.weth ? pool.token1 : pool.token0;
    }

    return targetToken;
  }

  getNearestPrice(prices: PriceAndBlock[], blockNumber) {
    return prices.find((obj) => {
      return (
        obj.blockNumber === blockNumber ||
        Math.abs(obj.blockNumber - blockNumber) <= CONFIG.getPriceBlockStep()
      );
    })?.price;
  }

  getOperationTypeByTransfer(transfers: RawTransfer[]) {
    const inTransfers = transfers.filter(
      (transfer) => transfer.type === 'IN' && !transfer.isFee,
    );
    const outTransfers = transfers.filter(
      (transfer) => transfer.type === 'OUT' && !transfer.isFee,
    );

    if (inTransfers.length > 0 && outTransfers.length > 0) {
      return OPERATIONS.TRADE;
    } else if (inTransfers.length > 0) {
      return OPERATIONS.IN;
    } else if (outTransfers.length > 0) {
      return OPERATIONS.OUT;
    } else {
      return OPERATIONS.CONTRACT_INTERACTION;
    }
  }

  parsePoolCreationEvent(event: any, dexName: DEX) {
    if (
      [
        DEX.PANCAKESWAP_V2,
        DEX.UNISWAP_V2,
        DEX.QUICKSWAP_V2,
        DEX.SUSHISWAP_V2,
        DEX.TRADER_JOE,
      ].includes(dexName)
    ) {
      return this.parseV2PoolCreationEvent(event);
    } else if ([DEX.UNISWAP_V3, DEX.PANCAKESWAP_V3].includes(dexName)) {
      return this.parseV3PoolCreationEvent(event);
    }
  }

  getTopicWithPriceByDex(dexName: string) {
    if (
      [
        DEX.PANCAKESWAP_V2,
        DEX.UNISWAP_V2,
        DEX.QUICKSWAP_V2,
        DEX.SUSHISWAP_V2,
        DEX.TRADER_JOE,
      ].includes(dexName as DEX)
    ) {
      // Sync event
      return '0x1c411e9a96e071241c2f21f7726b17ae89e3cab4c78be50e062b03a9fffbbad1';
    } else if ([DEX.UNISWAP_V3, DEX.PANCAKESWAP_V3].includes(dexName as DEX)) {
      // Swap event
      return '0xc42079f94a6350d7e6235f29174924f928cc2ac818eb64fed8004e115fbcca67';
    }
  }

  isV2(dexName: DEX): boolean {
    return ![DEX.UNISWAP_V3, DEX.PANCAKESWAP_V3].includes(dexName);
  }

  calculateV2Price({
    reserve0,
    reserve1,
    decimal0,
    decimal1,
    isTargetTokenFirst,
  }: {
    reserve0: bigint;
    reserve1: bigint;
    decimal0: number;
    decimal1: number;
    isTargetTokenFirst: boolean;
  }) {
    if (reserve0 === 0n || reserve1 === 0n) {
      return 0;
    }
    const price = isTargetTokenFirst
      ? (10 ** decimal0 * Number(reserve1)) / Number(reserve0) / 10 ** decimal1
      : (10 ** decimal1 * Number(reserve0)) / Number(reserve1) / 10 ** decimal0;

    if (price > 9.999999999999999e20) {
      return 0;
    } else {
      return price;
    }
  }

  calculateV3Price({
    sqrtPriceX96,
    decimal0,
    decimal1,
    isTargetTokenFirst,
  }: {
    sqrtPriceX96: bigint;
    decimal0: number;
    decimal1: number;
    isTargetTokenFirst: boolean;
  }) {
    const price = univ3prices(
      [decimal0, decimal1],
      sqrtPriceX96.toString(),
    ).toAuto({
      reverse: isTargetTokenFirst,
    });
    const numberPrice = parseFloat(price);

    if (numberPrice > 9.999999999999999e20) {
      return 0;
    } else {
      return numberPrice;
    }
  }

  parseLiquidity(reserve: bigint, decimals: number) {
    return parseFloat(ethers.formatUnits(reserve, decimals)) * 2;
  }

  parseV2PoolCreationEvent(event: any) {
    // @ts-ignore
    const args = event.args;
    const [rawToken0, rawToken1, poolAddr] = args;

    if (poolAddr && rawToken0 && rawToken1) {
      return {
        id: poolAddr.toLowerCase(),
        token0: rawToken0.toLowerCase(),
        token1: rawToken1.toLowerCase(),
        fee: null,
        tickSpacing: null,
      };
    } else {
      return null;
    }
  }

  parseV3PoolCreationEvent(event: any) {
    // @ts-ignore
    const args = event.args;
    const [rawToken0, rawToken1, fee, tickSpacing, rawId] = args;

    if (rawId && rawToken0 && rawToken1) {
      return {
        id: rawId.toLowerCase(),
        token0: rawToken0.toLowerCase(),
        token1: rawToken1.toLowerCase(),
        fee: Number(fee),
        tickSpacing: Number(tickSpacing),
      };
    } else {
      return null;
    }
  }

  isUsdPool(pool: { token0: string; token1: string }) {
    return (
      CONFIG.usdTokens.includes(pool.token0) ||
      CONFIG.usdTokens.includes(pool.token1)
    );
  }

  reducePricesByTimeframe(prices: HistoricalPrice[]): HistoricalPrice[] {
    const reducedPrices: HistoricalPrice[] = [];
    // sort prices by block number ascending
    const sortedPrices = prices.sort((a, b) => a.blockNumber - b.blockNumber);
    let lastBlock = sortedPrices[0].blockNumber;

    const priceBlockStep = Math.ceil(
      (CONFIG.priceTimeframeMinutes * 60) / CONFIG.avgBlockTimeSeconds,
    );

    for (const price of sortedPrices) {
      if (price.blockNumber - lastBlock >= priceBlockStep) {
        reducedPrices.push(price);
        lastBlock = price.blockNumber;
      }
    }

    this.logger.debug(
      `Reduced prices from ${sortedPrices.length} to ${reducedPrices.length || 1}`,
    );

    if (reducedPrices.length === 0) {
      return [sortedPrices[sortedPrices.length - 1]];
    }

    return reducedPrices;
  }
}
