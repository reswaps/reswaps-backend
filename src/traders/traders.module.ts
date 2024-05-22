import { Module } from '@nestjs/common';
import { TradersService } from './traders.service';
import { TradersController } from './traders.controller';
import { PrismaModule } from 'src/prisma/prisma.module';
import { DownloaderModule } from 'src/downloader/downloader.module';

@Module({
  controllers: [TradersController],
  providers: [TradersService],
  imports: [PrismaModule, DownloaderModule],
})
export class TradersModule {}
