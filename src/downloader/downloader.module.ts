import { Module } from '@nestjs/common';
import { DownloaderService } from './downloader.service';
import { PrismaModule } from 'src/prisma/prisma.module';
import { ParserModule } from 'src/parser/parser.module';
import { Web3rpcModule } from 'src/web3rpc/web3rpc.module';

@Module({
  providers: [DownloaderService],
  imports: [PrismaModule, ParserModule, Web3rpcModule],
  exports: [DownloaderService],
})
export class DownloaderModule {}
