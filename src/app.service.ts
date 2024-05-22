import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { DownloaderService } from './downloader/downloader.service';
import { Web3rpcService } from './web3rpc/web3rpc.service';

@Injectable()
export class AppService implements OnModuleInit {
  private readonly logger = new Logger(AppService.name);

  constructor(
    private downloader: DownloaderService,
    private web3rpc: Web3rpcService,
  ) {}

  async onModuleInit(): Promise<any> {
    this.logger.log('Initializing');
    //await this.web3rpc.validateRpc();
    this.downloader.syncPoolsAndTokens();
    //await this.downloader.syncLiquidity();
    //await this.downloader.syncBestPoolsTokens();
    //await this.downloader.syncHistoricalPrices();
    //await this.downloader.test();
    this.logger.log('Initialized');
  }
}
