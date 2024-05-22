import { Module } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { PrismaModule } from './prisma/prisma.module';
import { ConfigModule } from '@nestjs/config';
import { DownloaderModule } from './downloader/downloader.module';
import { TradersModule } from './traders/traders.module';
import { ParserModule } from './parser/parser.module';
import { Web3rpcModule } from './web3rpc/web3rpc.module';

@Module({
  imports: [
    PrismaModule,
    ScheduleModule.forRoot(),
    ConfigModule.forRoot({ isGlobal: true }),
    DownloaderModule,
    TradersModule,
    ParserModule,
    Web3rpcModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
