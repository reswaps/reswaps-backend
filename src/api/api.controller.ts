import { Controller, Get, Query, Res } from '@nestjs/common';
import { Response } from 'express';
import { ApiService } from './api.service';

@Controller('')
export class ApiController {
  constructor(private readonly apiService: ApiService) {}

  @Get('analyze')
  getTrader(@Query('address') address: string) {
    return this.apiService.getTrader(address.toLowerCase());
  }

  @Get('top')
  async getTop(@Query('count') count: number) {
    return await this.apiService.getTop(count);
  }

  @Get('debug')
  async debug() {
    return await this.apiService.debug();
  }

  @Get('addScamToken')
  async addScamToken(@Query('address') address: string) {
    return this.apiService.addScamToken(address.toLowerCase());
  }
}
