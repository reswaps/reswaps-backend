import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios from 'axios';
import { ethers, JsonRpcProvider } from 'ethers-v6';
import { ethers as ethersv5 } from 'ethers';
import { CONFIG } from 'src/constants/config';
import { CHAIN_IDS } from 'src/constants/names';

@Injectable()
export class Web3rpcService {
  private readonly logger = new Logger(Web3rpcService.name);
  private providers: JsonRpcProvider[];
  private v5providers: ethersv5.providers.JsonRpcProvider[];
  private urls: string[];
  public provider: JsonRpcProvider;
  public url: string;
  public v5provider: ethersv5.providers.JsonRpcProvider;
  private currentProviderIndex = 0;

  constructor(private readonly configService: ConfigService) {
    this.urls = this.configService.get('RPC_URLS').split(',');
    this.providers = this.urls.map((url) => new ethers.JsonRpcProvider(url));
    this.v5providers = this.urls.map(
      (url) => new ethersv5.providers.JsonRpcProvider(url),
    );
    this.v5provider = this.v5providers[this.currentProviderIndex];
    this.provider = this.providers[this.currentProviderIndex];
    this.url = this.urls[this.currentProviderIndex];
  }

  async validateRpc() {
    for (const provider of this.providers) {
      const network = await provider.getNetwork();
      if (CHAIN_IDS[CONFIG.chain] !== Number(network.chainId)) {
        throw new Error(
          `Chain ID mismatch. Check CONFIG.chain and RPC_URLS in .env file. Expected chain ID: ${CHAIN_IDS[CONFIG.chain]}, got chain ID: ${network.chainId}`,
        );
      }
    }
    this.logger.log('RPC validated');
  }

  changeProvider() {
    const nextIndex =
      this.currentProviderIndex + 1 >= this.providers.length
        ? 0
        : this.currentProviderIndex + 1;
    this.currentProviderIndex = nextIndex;
    this.provider = this.providers[nextIndex];
    this.v5provider = this.v5providers[nextIndex];
    this.url = this.urls[nextIndex];
  }

  async batchCall(
    method: string,
    paramsArr: Array<any>[],
  ): Promise<Array<any>> {
    return await this.reTryCall(() => {
      return axios
        .post(
          this.url,
          paramsArr.map((params, index) => ({
            id: index + 1,
            jsonrpc: '2.0',
            method,
            params,
          })),
        )
        .then((res) => {
          const results = [];

          for (const r of res.data) {
            if (r.error) {
              throw Error(`Batch call error: ${r.error.message}`);
            }
            results.push(r.result);
          }
          return results;
        });
    });
  }

  async call(
    method: string,
    params: Array<any> | Record<string, any>,
  ): Promise<any> {
    return await this.reTryCall(() => {
      return axios
        .post(this.url, {
          jsonrpc: '2.0',
          method,
          params,
        })
        .then((res) => res.data);
    });
  }

  async reTryCall(callback, times = 2) {
    try {
      return await callback();
    } catch (error) {
      if (times > 0) {
        this.logger.error(error?.message);
        this.logger.debug(`Retrying call ${times} times`);
        this.changeProvider();
        return await this.reTryCall(callback, times - 1);
      } else {
        throw error;
      }
    }
  }

  async historicalMultiCall(
    targets,
    ABI,
    methodName,
    args = [],
    everyArg: boolean,
    blockNumber: number,
  ) {
    const Multicall = new ethersv5.Contract(
      CONFIG.multicallAddress,
      CONFIG.multicallAbi,
      this.v5provider,
    );

    const iface = new ethers.Interface(ABI);
    let calls = [];

    if (everyArg) {
      calls = targets.map((target, index) => ({
        target,
        allowFailure: true,
        callData: iface.encodeFunctionData(methodName, [args[index]]),
      }));
    } else {
      calls = targets.map((target) => ({
        target,
        allowFailure: true,
        callData: iface.encodeFunctionData(methodName, args),
      }));
    }

    const results = await Multicall.callStatic.aggregate(calls, {
      blockTag: blockNumber,
    });

    const decodedResults = [];

    for (const result of results[1]) {
      try {
        decodedResults.push(iface.decodeFunctionResult(methodName, result));
      } catch (e) {
        decodedResults.push(false);
      }
    }
    return decodedResults;
  }

  async multicall(targets, ABI, methodName, args = [], everyArg) {
    const Multicall = new ethers.Contract(
      CONFIG.multicallAddress,
      CONFIG.multicallAbi,
      this.provider,
    );
    const iface = new ethers.Interface(ABI);
    let calls = [];

    if (everyArg) {
      calls = targets.map((target, index) => ({
        target,
        allowFailure: true,
        callData: iface.encodeFunctionData(methodName, [args[index]]),
      }));
    } else {
      calls = targets.map((target) => ({
        target,
        allowFailure: true,
        callData: iface.encodeFunctionData(methodName, args),
      }));
    }

    const results = await Multicall.getFunction('aggregate').staticCall(calls);
    const decodedResults = [];

    for (const result of results[1]) {
      try {
        decodedResults.push(iface.decodeFunctionResult(methodName, result));
      } catch (e) {
        decodedResults.push(false);
      }
    }
    return decodedResults;
  }

  async multiCallWithRetry(targets, ABI, methodName, args = [], everyArg) {
    return await this.reTryCall(() =>
      this.multicall(targets, ABI, methodName, args, everyArg),
    );
  }
}
