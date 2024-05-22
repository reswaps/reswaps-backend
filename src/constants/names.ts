export enum CHAINS {
  'ETHEREUM' = 'ETHEREUM',
  'BSC' = 'BSC',
  'AVALANCHE' = 'AVALANCHE',
  'FANTOM' = 'FANTOM',
  'POLYGON' = 'POLYGON',
}

export enum COINAPI_SYMBOLS {
  'ETH' = 'ETH',
  'BSC' = 'BSC',
}

export enum DEX {
  'UNISWAP_V2' = 'UNISWAP_V2',
  'UNISWAP_V3' = 'UNISWAP_V3',
  'SUSHISWAP_V2' = 'SUSHISWAP_V2',
  'PANCAKESWAP_V1' = 'PANCAKESWAP_V1',
  'PANCAKESWAP_V2' = 'PANCAKESWAP_V2',
  'PANCAKESWAP_V3' = 'PANCAKESWAP_V3',
  'QUICKSWAP_V2' = 'QUICKSWAP_V2',
  'TRADER_JOE' = 'TRADER_JOE',
}

export const DEX_MORALIS = {
  [DEX.UNISWAP_V2]: 'uniswapv2',
  [DEX.UNISWAP_V3]: 'uniswapv3',
  [DEX.SUSHISWAP_V2]: 'sushiswapv2',
  [DEX.PANCAKESWAP_V1]: 'pancakeswapv1',
  [DEX.PANCAKESWAP_V2]: 'pancakeswapv2',
  [DEX.PANCAKESWAP_V3]: 'pancakeswapv3',
  [DEX.QUICKSWAP_V2]: 'quickswapv2',
  [DEX.TRADER_JOE]: 'traderjoe',
};

export const CHAINS_MORALIS = {
  [CHAINS.ETHEREUM]: 'eth',
  [CHAINS.BSC]: 'bsc',
  [CHAINS.AVALANCHE]: 'avax',
  [CHAINS.FANTOM]: 'ftm',
  [CHAINS.POLYGON]: 'polygon',
};

export const CHAIN_IDS = {
  [CHAINS.ETHEREUM]: 1,
  [CHAINS.BSC]: 56,
  [CHAINS.AVALANCHE]: 43114,
  [CHAINS.FANTOM]: 250,
  [CHAINS.POLYGON]: 137,
};

export const OPERATIONS = {
  REINIT: 'REINIT',
  INIT: 'INIT',
  IN: 'IN',
  UNPRICED_IN: 'UNPRICED_IN',
  OUT: 'OUT',
  UNPRICED_OUT: 'UNPRICED_OUT',
  TRADE: 'TRADE',
  CONTRACT_INTERACTION: 'CONTRACT_INTERACTION',
};

export const NATIVE = 'NATIVE';
