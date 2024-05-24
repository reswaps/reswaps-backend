import { Module } from '@nestjs/common';
import { ApiService } from './api.service';
import { ApiController } from './api.controller';
import { PrismaModule } from 'src/prisma/prisma.module';
import { DownloaderModule } from 'src/downloader/downloader.module';

@Module({
  controllers: [ApiController],
  providers: [ApiService],
  imports: [PrismaModule, DownloaderModule],
})
export class ApiModule {}
