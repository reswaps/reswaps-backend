import { findNextBlock, getBlockIntervals, splitIntoChunks, splitObjectIntoChunks } from "@lib/common";
import { Injectable, Logger } from "@nestjs/common";
import { Cron, CronExpression } from "@nestjs/schedule";
import { type Prisma } from "@reswaps/prisma";
import { ethers } from "ethers-v6";
import { CONFIG } from "src/constants/config";
import { DEX, NATIVE } from "src/constants/names";
import { PrismaService } from "src/prisma/prisma.service";
import erc20_abi from "../constants/abi/erc20.json";
import v2_pool from "../constants/abi/UNISWAP_V2/pool.json";
import v3_pool from "../constants/abi/UNISWAP_V3/pool.json";

import { ParserService } from "src/parser/parser.service";
import { HistoricalPrice, HistoricalPriceRequests, Portfolio, PriceAndBlock, PriceMap, PricedPortfolio, TokensMap, TokensPool } from "./types";
import { Web3rpcService } from "src/web3rpc/web3rpc.service";
import axios from "axios";
import { ConfigService } from "@nestjs/config";
import { NEGATIVE_BALANCE_DURING_PARSING } from "src/constants/errors";

@Injectable()
export class DownloaderService {
  private readonly logger = new Logger(DownloaderService.name);
  constructor(
    private prisma: PrismaService,
    private parser: ParserService,
    private web3rpc: Web3rpcService,
    private readonly configService: ConfigService
  ) {}

  @Cron(CronExpression.EVERY_12_HOURS)
  async syncPoolsAndTokens() {
    for (const dex of CONFIG.dexes) {
      await this.syncPools(dex);
    }
    await this.syncTokens();
    //await this.syncLiquidity(24);
    await this.syncBestTokensPools();
    await this.syncHistoricalPrices();
  }

  async syncPools(dex: (typeof CONFIG.dexes)[number]) {
    const [lastPool, pools, toBlock, scamTokens] = await Promise.all([
      this.prisma.pools.findFirst({
        where: {
          dexName: dex.name,
        },
        orderBy: {
          createdAtBlock: "desc",
        },
      }),
      this.prisma.pools.findMany(),
      this.web3rpc.provider.getBlockNumber(),
      this.prisma.scamTokens.findMany(),
    ]);

    const fromBlock = lastPool ? lastPool.createdAtBlock : dex.factoryStartBlock;

    this.logger.log(`Loading pools for ${dex.name} from block ${fromBlock}`);

    const Factory = new ethers.Contract(dex.factoryAddress, dex.abi, this.web3rpc.provider);

    const intervals = getBlockIntervals(fromBlock, toBlock, 20000);
    const filter = Factory.filters[dex.poolCreationEventName](null);
    const batchSize = 5;
    const processedPoolIds = new Set(pools.map((pool) => pool.id));
    const scamTokensIds = new Set(scamTokens.map((token) => token.id));
    for (let i = 0; i < intervals.length; i += batchSize) {
      const intervalBatch = intervals.slice(i, i + batchSize);
      const resultBatch = await Promise.all(
        intervalBatch.map((interval) => {
          return this.web3rpc.queryFilterWithRetry(Factory, filter, interval[0], interval[1]);
        })
      );
      const data = [];

      for (const event of resultBatch.flat()) {
        const parsedEvent = this.parser.parsePoolCreationEvent(event, dex.name);
        if (parsedEvent) {
          const { id, token0, token1, fee, tickSpacing } = parsedEvent;
          if (!processedPoolIds.has(id) && event.removed === false && scamTokensIds.has(token0) === false && scamTokensIds.has(token1) === false) {
            data.push({
              id,
              dexName: dex.name,
              token0: token0.toLowerCase(),
              token1: token1.toLowerCase(),
              createdAtBlock: event.blockNumber,
              updatedAtBlock: event.blockNumber,
              fee,
              tickSpacing,
            });
            processedPoolIds.add(id);
          }
        }
      }

      await this.prisma.pools.createMany({
        data,
      });
      this.logger.log(`Loaded ${data.length} pools for ${dex.name}`);
    }
  }

  async syncBestTokensPools() {
    const [bestPools, tokensPools] = await Promise.all([
      this.prisma.pools.findMany({
        where: {
          liquidity: {
            not: null,
          },
        },
        orderBy: {
          liquidity: "desc",
        },
        take: CONFIG.tokensPoolsLimit,
      }),
      this.prisma.tokensPools.findMany({
        include: {
          pool: true,
        },
      }),
    ]);

    const tokenIds = new Set<string>();

    for (const pool of bestPools) {
      tokenIds.add(pool.token0);
      tokenIds.add(pool.token1);
    }

    const tokens = await this.getTokensMap(Array.from(tokenIds));
    const tokensPoolsReplace: Prisma.tokensPoolsCreateManyInput[] = [];

    for (const pool of bestPools) {
      const targetToken = this.parser.getTargetToken(pool);
      const decimal0 = tokens[pool.token0].decimals;
      const decimal1 = tokens[pool.token1].decimals;
      const isUsdPool = this.parser.isUsdPool(pool);

      const alreadyAdded = tokensPools.find((tp) => tp.id === targetToken);

      if (alreadyAdded) {
        const isAlreadyInReplace = tokensPoolsReplace.find((tp) => tp.id === targetToken);

        const isPoolsEqual = alreadyAdded.poolId === pool.id;
        const isUsdPoolFound = this.parser.isUsdPool(alreadyAdded);
        const newPoolBetterThanOld = pool.liquidity > alreadyAdded.pool.liquidity;
        const isOldPoolV3ButNewV2 = !this.parser.isV2(alreadyAdded.pool.dexName as DEX) && this.parser.isV2(pool.dexName as DEX);

        if (!isAlreadyInReplace && !isPoolsEqual && newPoolBetterThanOld && !isOldPoolV3ButNewV2 && isUsdPoolFound === isUsdPool) {
          tokensPoolsReplace.push({
            id: targetToken,
            poolId: pool.id,
            token0: pool.token0,
            token1: pool.token1,
            decimal0,
            decimal1,
          });
        }
      }
    }

    this.logger.log(`Replacing ${tokensPoolsReplace.length} tokens pools`);

    await this.prisma.$transaction(async (trx) => {
      await trx.tokensPools.deleteMany({
        where: {
          id: {
            in: tokensPoolsReplace.map((tp) => tp.id),
          },
        },
      });
      await trx.tokensPools.createMany({
        data: tokensPoolsReplace,
      });
    });

    const tokensPools2 = await this.prisma.tokensPools.findMany({
      include: {
        pool: true,
      },
    });

    const newTokensPools: Prisma.tokensPoolsCreateManyInput[] = [];

    for (const pool of bestPools) {
      const targetToken = this.parser.getTargetToken(pool);
      const decimal0 = tokens[pool.token0].decimals;
      const decimal1 = tokens[pool.token1].decimals;
      const alreadyAdded = tokensPools2.find((tp) => tp.id === targetToken);
      const alreadyInNewPools = newTokensPools.find((tp) => tp.id === targetToken);

      if (!alreadyAdded && !alreadyInNewPools) {
        newTokensPools.push({
          id: targetToken,
          poolId: pool.id,
          token0: pool.token0,
          token1: pool.token1,
          decimal0,
          decimal1,
        });
      }
    }

    this.logger.log(`Adding ${newTokensPools.length} new tokens pools`);

    await this.prisma.tokensPools.createMany({
      data: newTokensPools,
    });
  }

  async getTokensMap(tokenIds: string[]) {
    const tokens = await this.prisma.tokens.findMany({
      where: {
        id: {
          in: tokenIds,
        },
      },
    });

    return this.parser.getTokensMap(tokens);
  }

  async syncHistoricalPrices() {
    const [tokensPools, latestBlock] = await Promise.all([
      this.prisma.$queryRaw<
        {
          id: string;
          poolId: string;
          token0: string;
          token1: string;
          decimal0: number;
          decimal1: number;
          price: string;
          lastPriceBlockNumber: number;
          createdAtBlock: number;
          dexName: string;
        }[]
      >`SELECT tp.*,recent_price.price,recent_price."blockNumber" as "lastPriceBlockNumber", pools."createdAtBlock", pools."dexName" from "tokensPools" tp JOIN pools ON pools.id = tp."poolId" 
      LEFT JOIN (SELECT DISTINCT ON ("tokenId")
      "tokenId",
      price,
      "blockNumber"
      FROM
      prices
      ORDER BY
      "tokenId",
      "blockNumber" DESC) as recent_price ON tp.id = recent_price."tokenId";`,
      this.web3rpc.provider.getBlockNumber(),
    ]);

    const wethUsdPool = tokensPools.find((tp) => {
      const isUsdPool = this.parser.isUsdPool(tp);
      const isWeth = tp.token0 === CONFIG.weth || tp.token1 === CONFIG.weth;

      return isUsdPool && isWeth;
    });

    if (!wethUsdPool) {
      throw Error("WETH/USD pool not found");
    }

    const poolsWithoutWethUsd = tokensPools.filter((tp) => {
      return wethUsdPool.poolId !== tp.poolId;
    });

    const earliestBlock = CONFIG.priceStartBlock;
    const blockStep = CONFIG.getPriceBlockStep();
    const blocks = [];
    for (let i = earliestBlock; i < latestBlock; i += blockStep) {
      blocks.push(i);
    }
    blocks.push(latestBlock);

    const requests: HistoricalPriceRequests = {};
    const wethUsdRequests: HistoricalPriceRequests = {};

    const wethFromBlock = findNextBlock(wethUsdPool.lastPriceBlockNumber || Math.max(earliestBlock, wethUsdPool.createdAtBlock), blocks);

    for (let i = wethFromBlock; i < latestBlock; i += blockStep) {
      if (!wethUsdRequests[i]) {
        wethUsdRequests[i] = [];
      }

      wethUsdRequests[i].push({
        id: wethUsdPool.id,
        token0: wethUsdPool.token0,
        token1: wethUsdPool.token1,
        decimal0: wethUsdPool.decimal0,
        decimal1: wethUsdPool.decimal1,
        poolId: wethUsdPool.poolId,
        dexName: wethUsdPool.dexName,
      });
    }

    for (const tp of poolsWithoutWethUsd) {
      const fromBlock = findNextBlock(tp.lastPriceBlockNumber || Math.max(earliestBlock, tp.createdAtBlock), blocks);

      for (let i = fromBlock; i < latestBlock; i += blockStep) {
        if (!requests[i]) {
          requests[i] = [];
        }

        requests[i].push({
          id: tp.id,
          token0: tp.token0,
          token1: tp.token1,
          decimal0: tp.decimal0,
          decimal1: tp.decimal1,
          poolId: tp.poolId,
          dexName: tp.dexName,
        });
      }
    }

    const promiseAllSize = 20;

    const wethBatches = splitObjectIntoChunks(wethUsdRequests, Math.ceil(Object.keys(wethUsdRequests).length / promiseAllSize));

    this.logger.log(`Start loading historical prices for WETH/USD for ${wethBatches.length} batches`);
    for (let i = 0; i < wethBatches.length; i += promiseAllSize) {
      const batch = wethBatches.slice(i, i + promiseAllSize);
      await Promise.all(batch.map((b) => this.saveHistoricalPrices(b)));
    }
    this.logger.log("WETH/USD done");

    const wethUsdPrices = await this.getPriceMap([wethUsdPool.id]);

    const allBatches = splitObjectIntoChunks(requests, Math.ceil(Object.keys(requests).length / promiseAllSize));

    this.logger.log(`Start loading historical price for rest tokens for ${allBatches.length} batches`);
    for (let i = 0; i < allBatches.length; i += promiseAllSize) {
      const batch = allBatches.slice(i, i + promiseAllSize);
      await Promise.all(batch.map((b) => this.saveHistoricalPrices(b, wethUsdPrices[wethUsdPool.id])));
    }
    this.logger.log("Prices synced");
  }

  async saveHistoricalPrices(requests: HistoricalPriceRequests, wethUsdPrices?: PriceAndBlock[], size = CONFIG.multicallLimit) {
    this.logger.log(`Start loading historical prices with ${Object.keys(requests).length} blocks`);

    const fails: HistoricalPriceRequests = {};

    for (const blockNumber in requests) {
      if (requests[blockNumber]?.length > 0) {
        const bn = parseInt(blockNumber);
        const chunks = splitIntoChunks(requests[blockNumber], size);

        for (const chunk of chunks) {
          try {
            await this.saveHistoricalPriceForChunk(chunk, bn, wethUsdPrices);
          } catch (e) {
            if (!fails[bn]) {
              fails[bn] = [];
            }
            fails[bn].push(...chunk);
          }
        }
      }
    }

    if (Object.keys(fails).length > 0) {
      const newSize = Math.ceil(size / 2);
      this.logger.error(`Failed to load prices for ${Object.keys(fails).length} blocks. Retrying with size ${newSize}`);
      await this.saveHistoricalPrices(fails, wethUsdPrices, newSize);
    }
  }

  async getPriceMap(tokenIds: string[]): Promise<PriceMap> {
    const priceMap: PriceMap = {};
    const prices = await this.prisma.prices.findMany({
      where: {
        tokenId: {
          in: tokenIds,
        },
      },
      orderBy: {
        blockNumber: "asc",
      },
    });

    for (const { tokenId, blockNumber, price } of prices) {
      if (!priceMap[tokenId]) {
        priceMap[tokenId] = [];
      }
      priceMap[tokenId].push({
        blockNumber,
        price,
      });
    }

    return priceMap;
  }

  async saveHistoricalPriceForChunk(chunk: TokensPool[], blockNumber: number, wethUsdPrices?: PriceAndBlock[]) {
    const v2requests = chunk.filter((req) => this.parser.isV2(req.dexName as DEX));
    const v3requests = chunk.filter((req) => !this.parser.isV2(req.dexName as DEX));

    const wethPrice = wethUsdPrices && this.parser.getNearestPrice(wethUsdPrices, blockNumber);

    if (wethUsdPrices && !wethPrice) {
      throw Error(`WETH/USD price not found for blockNumber: ${blockNumber}`);
    }

    const [v2results, v3results] = await Promise.all([
      this.web3rpc.historicalMultiCall(
        v2requests.map((req) => req.poolId),
        v2_pool,
        "getReserves",
        [],
        false,
        blockNumber
      ),
      this.web3rpc.historicalMultiCall(
        v3requests.map((req) => req.poolId),
        v3_pool,
        "slot0",
        [],
        false,
        blockNumber
      ),
    ]);

    const tokenPrices: HistoricalPrice[] = [];

    for (let i = 0; i < v2requests.length; i++) {
      const { id, token0, decimal0, decimal1 } = v2requests[i];
      const result = v2results[i];

      if (result) {
        const [reserve0, reserve1] = result;
        let price = this.parser.calculateV2Price({
          reserve0,
          reserve1,
          decimal0,
          decimal1,
          isTargetTokenFirst: id === token0,
        });

        if (!this.parser.isUsdPool(v2requests[i])) {
          price = parseFloat(wethPrice) * price;
        }

        const priceString = price.toFixed(CONFIG.usdPrecision);

        tokenPrices.push({
          blockNumber: blockNumber,
          tokenId: id,
          price: priceString,
        });
      }
    }

    for (let i = 0; i < v3requests.length; i++) {
      const { id, token0, decimal0, decimal1 } = v3requests[i];
      const result = v3results[i];

      if (result) {
        const { sqrtPriceX96 } = result;
        let price = this.parser.calculateV3Price({
          sqrtPriceX96,
          decimal0,
          decimal1,
          isTargetTokenFirst: id === token0,
        });

        if (!this.parser.isUsdPool(v3requests[i])) {
          price = parseFloat(wethPrice) * price;
        }

        const priceString = price.toFixed(CONFIG.usdPrecision);

        tokenPrices.push({
          blockNumber: blockNumber,
          tokenId: id,
          price: priceString,
        });
      }
    }

    await this.prisma.prices.createMany({
      data: tokenPrices,
    });

    this.logger.log(`Saved ${tokenPrices.length} prices for block ${blockNumber}`);
  }

  async syncLiquidity(hours: number) {
    const blockNumber = await this.web3rpc.provider.getBlockNumber();
    const [pools, usdTokens] = await Promise.all([
      this.prisma.pools.findMany({
        where: {
          OR: [{ token0: { in: CONFIG.usdTokens } }, { token1: { in: CONFIG.usdTokens } }, { token0: CONFIG.weth }, { token1: CONFIG.weth }],
          updatedAtBlock: {
            lte: blockNumber - Math.ceil((hours * 60 * 60) / CONFIG.avgBlockTimeSeconds),
          },
        },
      }),
      this.prisma.tokens.findMany({
        where: {
          id: {
            in: CONFIG.usdTokens,
          },
        },
      }),
    ]);
    this.logger.log(`Syncing liquidity for ${pools.length} pools`);

    const usdTokensMap = this.parser.getTokensMap(usdTokens);

    const v2pools = pools.filter((pool) => this.parser.isV2(pool.dexName as DEX));

    const v3pools = pools.filter((pool) => !this.parser.isV2(pool.dexName as DEX));

    const { data } = await axios.get(this.configService.get("COINAPI_URL") + `/v1/exchangerate/${CONFIG.coinapiSymbol}/USD/`, {
      headers: { "X-CoinAPI-Key": this.configService.get("COINAPI_KEY") },
    });

    const wethPrice = parseFloat(data.rate.toFixed(0));
    const v2chunks = splitIntoChunks(v2pools, Math.ceil(v2pools.length / 7));
    const v3chunks = splitIntoChunks(v3pools, Math.ceil(v3pools.length / 7));

    await Promise.all(v2chunks.map((chunk) => this.loadV2Liquidity(chunk, usdTokensMap, wethPrice, blockNumber)));

    await Promise.all(v3chunks.map((chunk) => this.loadV3Liquidity(chunk, usdTokensMap, wethPrice, blockNumber)));
  }

  async loadV2Liquidity(pools: Prisma.poolsGetPayload<any>[], decimalsMap: any, wethPrice: number, blockNumber: number, size = 1000) {
    for (let i = 0; i < pools.length; i += size) {
      const poolData: Prisma.poolsCreateManyInput[] = [];
      const batch = pools.slice(i, i + size);
      const poolAddresses = batch.map((pool) => pool.id);

      const results = await this.web3rpc.multiCallWithRetry(poolAddresses, v2_pool, "getReserves", [], false);

      for (let j = 0; j < batch.length; j++) {
        const pool = batch[j];
        const result = results[j];

        if (result) {
          const [reserve0, reserve1] = result;
          const token0 = pool.token0;
          const token1 = pool.token1;
          let liquidity = 0;
          const isUsdPool = this.parser.isUsdPool(pool);

          if (isUsdPool) {
            if (CONFIG.usdTokens.includes(token0)) {
              liquidity = Math.ceil(this.parser.parseLiquidity(reserve0, decimalsMap[token0].decimals));
            } else {
              liquidity = Math.ceil(this.parser.parseLiquidity(reserve1, decimalsMap[token1].decimals));
            }
          } else {
            if (token0 === CONFIG.weth) {
              liquidity = Math.ceil(this.parser.parseLiquidity(reserve0, 18) * wethPrice);
            } else {
              liquidity = Math.ceil(this.parser.parseLiquidity(reserve1, 18) * wethPrice);
            }
          }

          poolData.push({
            ...pool,
            updatedAtBlock: blockNumber,
            liquidity,
          });
        } else {
          poolData.push({
            ...pool,
            updatedAtBlock: blockNumber,
            liquidity: 0,
          });
        }
      }

      await this.savePoolsWithUpdatedLiquidity(poolData);

      this.logger.log(`Loaded liquidity ${i + poolData.length} / ${pools.length} v2 pools`);
    }
  }

  async savePoolsWithUpdatedLiquidity(poolData: Prisma.poolsCreateManyInput[]) {
    await this.prisma.$transaction(async (trx) => {
      const poolIds = poolData.map((pool) => pool.id);
      const tokensPools = await trx.tokensPools.findMany({
        where: {
          poolId: {
            in: poolIds,
          },
        },
      });
      await trx.tokensPools.deleteMany({
        where: {
          id: {
            in: tokensPools.map((tp) => tp.id),
          },
        },
      });
      await trx.pools.deleteMany({
        where: {
          id: {
            in: poolIds,
          },
        },
      });
      await trx.pools.createMany({
        data: poolData,
      });
      await trx.tokensPools.createMany({
        data: tokensPools,
      });
    });
  }

  async loadV3Liquidity(
    pools: Prisma.poolsGetPayload<any>[],
    decimalsMap: { [token: string]: Omit<Prisma.tokensGetPayload<any>, "id"> },
    wethPrice: number,
    blockNumber: number,
    size = 1000
  ) {
    const fails = [];
    for (let i = 0; i < pools.length; i += size) {
      const poolData: Prisma.poolsCreateManyInput[] = [];
      const batch = pools.slice(i, i + size);
      const token0s = batch.map((pool) => pool.token0);
      const token1s = batch.map((pool) => pool.token1);
      const poolAddresses = batch.map((pool) => pool.id);
      try {
        const [token0reserves, token1reserves] = await Promise.all([
          this.web3rpc.multicall(token0s, erc20_abi, "balanceOf", poolAddresses, true),
          this.web3rpc.multicall(token1s, erc20_abi, "balanceOf", poolAddresses, true),
        ]);

        for (let j = 0; j < batch.length; j++) {
          const pool = batch[j];
          const reserve0 = token0reserves[j][0];
          const reserve1 = token1reserves[j][0];

          if (pool && reserve0 && reserve1) {
            const token0 = pool.token0;
            const token1 = pool.token1;

            let liquidity = 0;
            const isUsdPool = this.parser.isUsdPool(pool);

            if (isUsdPool) {
              if (CONFIG.usdTokens.includes(token0)) {
                liquidity = Math.ceil(this.parser.parseLiquidity(reserve0, decimalsMap[token0].decimals));
              } else {
                liquidity = Math.ceil(this.parser.parseLiquidity(reserve1, decimalsMap[token1].decimals));
              }
            } else {
              if (token0 === CONFIG.weth) {
                liquidity = Math.ceil(this.parser.parseLiquidity(reserve0, 18) * wethPrice);
              } else {
                liquidity = Math.ceil(this.parser.parseLiquidity(reserve1, 18) * wethPrice);
              }
            }

            poolData.push({
              ...pool,
              updatedAtBlock: blockNumber,
              liquidity,
            });
          } else {
            poolData.push({
              ...pool,
              updatedAtBlock: blockNumber,
              liquidity: 0,
            });
          }
        }

        await this.savePoolsWithUpdatedLiquidity(poolData);

        this.logger.log(`Loaded liquidity ${i + poolData.length} / ${pools.length} v3 pools`);
      } catch (e) {
        if (size === 1) {
          this.logger.error(`Failed to load pool ${batch[0].id}`);
        }
        fails.push(...batch);
      }
    }

    if (fails.length > 0) {
      if (size === 1) {
        await this.deletePools(fails);
      } else {
        const newSize = Math.ceil(size / 2);
        this.logger.log(`Retrying ${fails.length} v3 pools with size ${newSize}`);
        await this.loadV3Liquidity(fails, decimalsMap, wethPrice, newSize);
      }
    }
  }

  async syncTokens() {
    const pools = await this.prisma.pools.findMany();
    const storedTokens = await this.prisma.tokens.findMany();
    const storedTokenIds = new Set(storedTokens.map((token) => token.id));
    const tokens = new Set<string>();

    for (const pool of pools) {
      if (!storedTokenIds.has(pool.token0) && !tokens.has(pool.token0)) {
        tokens.add(pool.token0);
      }

      if (!storedTokenIds.has(pool.token1) && !tokens.has(pool.token1)) {
        tokens.add(pool.token1);
      }
    }
    const tokenAddresses = Array.from(tokens);

    if (tokenAddresses.length > 0) {
      this.logger.log(`Loading ${tokenAddresses.length} new tokens`);
      await this.loadTokens(tokenAddresses, 1000);
    }
  }

  async loadTokens(tokenAddresses: string[], size = 200) {
    const fails = [];

    for (let i = 0; i < tokenAddresses.length; i += size) {
      const batch = tokenAddresses.slice(i, i + size);

      try {
        const [decimalsBatch, namesBatch, symbolsBatch] = await Promise.all([
          this.web3rpc.multicall(batch, erc20_abi, "decimals", [], false),
          this.web3rpc.multicall(batch, erc20_abi, "name", [], false),
          this.web3rpc.multicall(batch, erc20_abi, "symbol", [], false),
        ]);

        const tokenData = batch.map((addr, index) => ({
          id: addr,
          decimals: Number(decimalsBatch[index]),
          name: namesBatch[index][0] || "",
          symbol: symbolsBatch[index][0] || "",
        }));

        await this.prisma.tokens.createMany({
          data: tokenData,
        });
        this.logger.log(`Loaded ${i + size} / ${tokenAddresses.length} tokens`);
      } catch (e) {
        if (size === 1) {
          this.logger.error(`Failed to load token ${batch[0]}`);
        }
        fails.push(...batch);
      }
    }

    if (fails.length > 0) {
      if (size === 1) {
        await this.deletePoolsWithFailedTokens(fails);
      } else {
        const newSize = Math.ceil(size / 2);
        this.logger.log(`Retrying ${fails.length} pools with size ${newSize}`);
        this.loadTokens(fails, newSize);
      }
    }
  }

  async deletePools(pools: Prisma.poolsGetPayload<any>[]) {
    await this.prisma.pools.deleteMany({
      where: {
        id: {
          in: pools.map((pool) => pool.id),
        },
      },
    });
  }

  async deletePoolsWithFailedTokens(failedTokens: string[]) {
    const pools = await this.prisma.pools.findMany({
      where: {
        OR: [{ token0: { in: failedTokens } }, { token1: { in: failedTokens } }],
      },
    });

    await this.prisma.pools.deleteMany({
      where: {
        id: {
          in: pools.map((pool) => pool.id),
        },
      },
    });

    this.logger.warn(`Deleted ${pools.length} pools with failed tokens`);
  }

  async syncTrader(trader: { id: string; address: string }, retryCount = 0) {
    this.logger.debug(`Loading trader ${trader.address}`);
    await this.syncTransactions(trader.id, trader.address);
    try {
      await this.syncOperations(trader.id, trader.address);
    } catch (e: any) {
      if (e?.message === NEGATIVE_BALANCE_DURING_PARSING && retryCount < 3) {
        this.logger.error(`Failed to sync operations for ${trader.address}. ${NEGATIVE_BALANCE_DURING_PARSING}`);
        retryCount++;
        this.logger.log(`Deleting all transactions for ${trader.address} and retrying ${retryCount} more times`);
        await this.prisma.transactions.deleteMany({
          where: {
            traderId: trader.id,
          },
        });
        await this.syncTrader(trader, retryCount);
      } else {
        throw e;
      }
    }

    return await this.getCurrentTpv(trader.id);
  }

  async getCurrentTpv(traderId: string) {
    const lastOperation = await this.prisma.operations.findFirst({
      where: {
        traderId,
      },
      orderBy: [{ blockNumber: "desc" }, { transactionIndex: "desc" }],
    });

    const lastPortfolio = lastOperation?.portfolio as Portfolio;
    const tokens = [...Object.keys(lastPortfolio), CONFIG.weth];

    const tokensWithPrices = await this.prisma.tokens.findMany({
      include: {
        prices: {
          orderBy: {
            blockNumber: "desc",
          },
          take: 1,
        },
      },
      where: {
        id: {
          in: tokens,
        },
      },
    });

    let tpv = 0;

    const portfolioWtihPrices: PricedPortfolio = {};

    for (const token in lastPortfolio) {
      const tokenId = token === NATIVE ? CONFIG.weth : token;
      const { amount, decimals } = lastPortfolio[token];
      const tokenData = tokensWithPrices.find((t) => t.id === tokenId);
      if (tokenData) {
        const price = CONFIG.usdTokens.includes(tokenId) ? 1 : parseFloat(tokenData.prices[0]?.price) || 0;
        const amountNumber = Number(ethers.formatUnits(amount, decimals));
        const value = price * amountNumber;
        tpv += value;
        portfolioWtihPrices[token] = {
          amount,
          decimals,
          price,
          value,
        };
      }
    }

    return {
      tpv,
      portfolio: portfolioWtihPrices,
    };
  }

  async syncTransactions(traderId: string, address: string) {
    const lastTransaction = await this.prisma.transactions.findFirst({
      where: {
        traderId,
      },
      orderBy: [
        {
          blockNumber: "desc",
        },
        {
          transactionIndex: "desc",
        },
      ],
    });

    const fromBlock = lastTransaction?.lastUpdatedBlock
      ? "0x" + lastTransaction?.lastUpdatedBlock?.toString(16)
      : lastTransaction?.blockNumber
        ? "0x" + lastTransaction?.blockNumber.toString(16)
        : "0x0";

    const uniqueTxs = [];
    const minimizeTx = (tx: any) => {
      return {
        hash: tx.hash,
        blockNumber: parseInt(tx.blockNum, 16),
        value: tx.category !== "erc20" ? ethers.parseEther(tx.value.toFixed(18)).toString() : "0",
        date: tx.metadata.blockTimestamp,
        from: tx.from.toLowerCase(),
        to: tx.to.toLowerCase(),
        internalTxs: [],
      };
    };

    const [external, internal, erc20] = await Promise.all([
      this.getAssetTransfers(address, fromBlock, ["external"]),
      this.getAssetTransfers(address, fromBlock, ["internal"]),
      this.getAssetTransfers(address, fromBlock, ["erc20"]),
    ]);

    for (const tx of external.concat(erc20)) {
      if (tx.hash !== lastTransaction?.hash) {
        const existingTx = uniqueTxs.find((utx) => utx.hash === tx.hash);
        if (!existingTx) {
          uniqueTxs.push(minimizeTx(tx));
        }
      }
    }

    for (const tx of internal) {
      if (tx.hash !== lastTransaction?.hash) {
        const existingTxIndex = uniqueTxs.findIndex((utx) => utx.hash === tx.hash);

        if (existingTxIndex < 0) {
          uniqueTxs.push(minimizeTx(tx));
        } else {
          uniqueTxs[existingTxIndex].internalTxs.push({
            value: ethers.parseEther(tx.value.toFixed(18)).toString(),
            from: tx.from.toLowerCase(),
            to: tx.to.toLowerCase(),
          });
        }
      }
    }

    this.logger.debug(`Syncing ${uniqueTxs.length} transactions`);
    const batchSize = 1000;
    const sortedTx = uniqueTxs.sort((a, b) => a.blockNumber - b.blockNumber);

    const chunks = splitIntoChunks(sortedTx, Math.ceil(sortedTx.length / 3));
    let synced = 0;

    try {
      await Promise.all(
        chunks.map(async (chunk) => {
          for (let i = 0; i < chunk.length; i += batchSize) {
            const finalTxs: Prisma.transactionsCreateManyInput[] = [];
            const batch = chunk.slice(i, i + batchSize);
            const receipts = await this.web3rpc.batchCall(
              "eth_getTransactionReceipt",
              batch.map((tx) => [tx.hash])
            );

            for (let j = 0; j < batch.length; j++) {
              const tx = batch[j];
              const receipt = receipts[j];
              const isFakeERC20 = receipt.from.toLowerCase() !== tx.from;

              finalTxs.push({
                ...tx,
                transactionIndex: parseInt(receipt.transactionIndex, 16),
                traderId,
                logs: receipt.logs,
                gasUsed: isFakeERC20 ? "0" : (ethers.getBigInt(receipt.gasUsed) * ethers.getBigInt(receipt.effectiveGasPrice)).toString(),
                isFailed: receipt.status === "0x0",
              });
            }

            if (finalTxs.length > 0) {
              await this.prisma.transactions.createMany({
                data: finalTxs,
              });
            }
            synced += batch.length;

            this.logger.debug(`Synced ${synced} / ${uniqueTxs.length} txs`);
          }
        })
      );
    } catch (e) {
      this.logger.error("Error syncing transactions", e);
    }
  }

  async syncOperations(traderId: string, traderAddress: string): Promise<number> {
    this.logger.debug("Start syncing operations");

    const operations = await this.getOperationsFromTransactions(traderId, traderAddress);

    this.logger.debug("Operations loaded");
    if (operations.length > 0) {
      const operationsChunks = splitIntoChunks(operations, Math.ceil(operations.length / 10));

      await Promise.all(
        operationsChunks.map((chunk) => {
          return this.prisma.operations.createMany({
            data: chunk,
          });
        })
      );
      this.logger.debug(`Synced ${operations.length} operations`);
    }

    return operations[0]?.blockNumber;
  }

  async getOperationsFromTransactions(traderId: string, traderAddress: string): Promise<Prisma.operationsCreateManyInput[]> {
    const [transactions, tokensPools] = await Promise.all([
      this.prisma.transactions.findMany({
        where: {
          traderId,
          operation: null,
        },
        orderBy: [{ blockNumber: "asc" }, { transactionIndex: "asc" }],
      }),
      this.prisma.tokensPools.findMany({
        select: {
          token: true,
        },
      }),
    ]);

    if (transactions.length === 0) {
      return [];
    }

    const tokens: TokensMap = {};
    for (const { token } of tokensPools) {
      const { id, ...rest } = token;
      tokens[id] = rest;
    }

    const prevOperation = await this.prisma.operations.findFirst({
      select: {
        portfolio: true,
      },
      where: {
        traderId,
        blockNumber: {
          lt: transactions[0].blockNumber,
        },
      },
      orderBy: [
        {
          blockNumber: "desc",
        },
        { transactionIndex: "desc" },
      ],
    });

    let prevPortfolio: Portfolio = (prevOperation?.portfolio as Portfolio) || {};

    const operations: Prisma.operationsCreateManyInput[] = [];

    for (const tx of transactions) {
      const transfers = this.parser.parseTransactionToTransfers(tx, traderAddress, tokens);
      const portfolio = this.parser.parseTransfersToPortfolio(transfers, prevPortfolio);

      operations.push({
        txId: tx.id,
        blockNumber: tx.blockNumber,
        transactionIndex: tx.transactionIndex,
        transfers: transfers as unknown as Prisma.InputJsonValue[],
        portfolio: portfolio,
        traderId,
        operationType: this.parser.getOperationTypeByTransfer(transfers),
        gasPaid: transfers.find((transfer) => transfer.isFee)?.amount || "0",
      });

      prevPortfolio = { ...portfolio };
    }

    return operations;
  }

  async getAssetTransfers(address: string, fromBlock: string, category: string[], accumulatedTransfers: any[] = [], pageKeyFrom?: string, pageKeyTo?: string) {
    const generalParams = {
      fromBlock,
      toBlock: "latest",
      withMetadata: true,
      excludeZeroValue: false,
      order: "asc",
      category,
    };

    const payloadTo: any = { ...generalParams };
    const payloadFrom: any = { ...generalParams };

    if (pageKeyFrom) {
      payloadFrom["pageKey"] = pageKeyFrom;
    }

    if (pageKeyTo) {
      payloadTo["pageKey"] = pageKeyTo;
    }

    payloadTo.toAddress = address;
    payloadFrom.fromAddress = address;

    const [txsFrom, txsTo] = await Promise.all([
      pageKeyFrom || accumulatedTransfers.length === 0 ? this.web3rpc.call("alchemy_getAssetTransfers", [payloadFrom]) : Promise.resolve(),
      pageKeyTo || accumulatedTransfers.length === 0 ? this.web3rpc.call("alchemy_getAssetTransfers", [payloadTo]) : Promise.resolve(),
    ]);

    const transfersFrom = txsFrom?.result?.transfers || [];
    const transfersTo = txsTo?.result?.transfers || [];

    accumulatedTransfers.push(...transfersFrom, ...transfersTo);
    this.logger.debug(`Loaded accumulated transfers: ${accumulatedTransfers.length}`);

    if (txsFrom?.result?.pageKey || txsTo?.result?.pageKey) {
      await this.getAssetTransfers(address, fromBlock, category, accumulatedTransfers, txsFrom?.result?.pageKey, txsTo?.result?.pageKey);
    }

    return accumulatedTransfers;
  }

  getPools(pools: Prisma.poolsGetPayload<any>[], token: string, to_block: number): Prisma.poolsGetPayload<any>[] {
    const result: Prisma.poolsGetPayload<any>[] = [];

    const [usdt, usdc, dai] = CONFIG.usdTokens;
    const usdtPools = pools.filter((pool) => {
      const isTokensMatch = (pool.token0 === token && pool.token1 === usdt) || (pool.token1 === token && pool.token0 === usdt);
      return isTokensMatch && pool.createdAtBlock < to_block;
    });

    const usdcPools = pools.filter((pool) => {
      const isTokensMatch = (pool.token0 === token && pool.token1 === usdc) || (pool.token1 === token && pool.token0 === usdc);
      return isTokensMatch && pool.createdAtBlock < to_block;
    });

    const daiPools = pools.filter((pool) => {
      const isTokensMatch = (pool.token0 === token && pool.token1 === dai) || (pool.token1 === token && pool.token0 === dai);
      return isTokensMatch && pool.createdAtBlock < to_block;
    });

    if (result.length > 0) return result;

    const wethPools = pools.filter(
      (pool) =>
        ((pool.token0 === token && pool.token1 === CONFIG.weth) || (pool.token1 === token && pool.token0 === CONFIG.weth)) && pool.createdAtBlock < to_block
    );

    const usdPools = [...usdtPools, ...usdcPools, ...daiPools];
    const uniswapV2Priority = usdPools.filter((pool) => pool.dexName === DEX.UNISWAP_V2);

    const uniswapV2PriorityWeth = wethPools.filter((pool) => pool.dexName === DEX.UNISWAP_V2);

    if (uniswapV2Priority.length > 1) {
      result.push(...uniswapV2Priority.slice(0, 2));
    } else {
      result.push(...usdPools.slice(0, 3));
    }

    if (uniswapV2PriorityWeth.length > 0) {
      result.push(...uniswapV2PriorityWeth.slice(0, 2));
    } else {
      result.push(...wethPools.slice(0, 3));
    }

    return result;
  }
}
