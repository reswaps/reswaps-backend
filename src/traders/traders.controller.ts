import { Controller, Get, Param } from '@nestjs/common';
import { TradersService } from './traders.service';

@Controller('traders')
export class TradersController {
  constructor(private readonly tradersService: TradersService) {}

  @Get('get/:address')
  getTrader(@Param('address') address: string) {
    return this.tradersService.getTrader(address.toLowerCase());
  }

  @Get('top')
  async getTop(@Param('count') count: number) {
    return await this.tradersService.getTop(count);
  }

  @Get('debug')
  async debug() {
    return await this.tradersService.debug();
  }
}
