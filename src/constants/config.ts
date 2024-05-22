import { CHAINS, COINAPI_SYMBOLS, DEX } from './names';
import uniswap_v3_factory_abi from './abi/UNISWAP_V3/factory.json';
import uniswap_v2_factory_abi from './abi/UNISWAP_V2/factory.json';
import multicall_abi from './abi/multicall.json';

export const CONFIG = {
  chain: CHAINS.ETHEREUM,
  coinapiSymbol: COINAPI_SYMBOLS.ETH,
  multicallAddress: '0xeefBa1e63905eF1D7ACbA5a8513c70307C1cE441',
  weth: '0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2',
  usdTokens: [
    '0xdac17f958d2ee523a2206206994597c13d831ec7', // USDT
    '0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48', // USDC
    '0x6b175474e89094c44da98b954eedeac495271d0f', // DAI
  ],
  wethUsdtPool: '0x0d4a11d5EEaaC28EC3F61d100daF4d40471f1852',
  multicallAbi: multicall_abi,
  usdPrecision: 6,
  batchCallLimit: 1000,
  multicallLimit: 1000,
  avgBlockTimeSeconds: 13.7,
  priceTimeframeMinutes: 60,
  priceHistoryLengthDays: 90,
  tokensPoolsLimit: 2300,
  dexes: [
    {
      name: DEX.UNISWAP_V2,
      abi: uniswap_v2_factory_abi,
      factoryAddress: '0x5C69bEe701ef814a2B6a3EDD4B1652CB9cc5aA6f',
      factoryStartBlock: 10008355,
      poolCreationEventName: 'PairCreated',
    },
    {
      name: DEX.UNISWAP_V3,
      abi: uniswap_v3_factory_abi,
      factoryAddress: '0x1F98431c8aD98523631AE4a59f267346ea31F984',
      factoryStartBlock: 12369662,
      poolCreationEventName: 'PoolCreated',
    },
    {
      name: DEX.SUSHISWAP_V2,
      abi: uniswap_v2_factory_abi,
      factoryAddress: '0xC0AEe478e3658e2610c5F7A4A2E1777cE9e4f2Ac',
      factoryStartBlock: 10822038,
      poolCreationEventName: 'PairCreated',
    },
  ],
  getPriceStartBlocksAgo() {
    return Math.ceil(
      (this.priceHistoryLengthDays * 24 * 60 * 60) / this.avgBlockTimeSeconds,
    );
  },
  getPriceBlockStep() {
    return Math.ceil(
      (this.priceTimeframeMinutes * 60) / this.avgBlockTimeSeconds,
    );
  },
};
