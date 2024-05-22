import { Module } from '@nestjs/common';
import { Web3rpcService } from './web3rpc.service';

@Module({
  providers: [Web3rpcService],
  exports: [Web3rpcService],
})
export class Web3rpcModule {}
