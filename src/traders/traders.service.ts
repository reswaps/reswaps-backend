import { Injectable } from '@nestjs/common';
import { ethers } from 'ethers-v6';
import { CONFIG } from 'src/constants/config';
import { NATIVE } from 'src/constants/names';
import { DownloaderService } from 'src/downloader/downloader.service';
import { Portfolio, PricedPortfolio } from 'src/downloader/types';
import { PrismaService } from 'src/prisma/prisma.service';

class Fund {
  shares: number;
  tpv: number;
  realizedPnl: number;
  wapBuy: number;
  wapSell: number;
  deposits: { shares: number; price: number }[];
  withdrawals: { shares: number; price: number }[];

  constructor() {
    this.shares = 0;
    this.tpv = 0;
    this.realizedPnl = 0;
    this.wapBuy = 0;
    this.wapSell = 0;
    this.deposits = [];
    this.withdrawals = [];
  }

  deposit(amount: number) {
    if (this.shares === 0) {
      //console.log(`init ${amount}`);
      this.shares = amount;
      this.tpv = amount;
      this.wapBuy = 1;
      this.wapSell = 1;
      this.realizedPnl = 0;
      this.deposits.push({ shares: amount, price: 1 });
    } else {
      const sharePrice = this.sharePrice();
      const sharesIssued = amount / sharePrice;
      this.shares += sharesIssued;
      this.tpv += amount;
      this.deposits.push({ shares: sharesIssued, price: sharePrice });
      this.wapBuy = this.getWAPBuy();
      // console.log(
      //   `DEPOSIT ${amount}, ${sharesIssued}, ${sharePrice}, ${this.wapBuy}`,
      // );
    }
  }

  withdraw(amount: number) {
    if (this.shares !== 0) {
      const sharePrice = this.sharePrice();
      const unrealizedPnl = this.tpv - this.shares * this.wapBuy;
      const ratio = amount / this.tpv;
      const realizedPnl = ratio * unrealizedPnl;
      if (realizedPnl > 0) {
        this.realizedPnl += realizedPnl;
      } else {
        this.realizedPnl -= Math.abs(realizedPnl);
      }
      const sharesBurned = this.shares * ratio;

      this.shares -= sharesBurned;
      this.tpv -= amount;
      this.withdrawals.push({ shares: sharesBurned, price: sharePrice });
      this.wapSell = this.getWAPSell();
      // console.log(
      //   `WITHDRAW: ${amount}, ${sharesBurned}, ${sharePrice}, ${this.wapSell}`,
      // );
    } else {
      throw Error('Cannot withdraw from empty fund');
    }
  }

  getWAPBuy() {
    const totalShares = this.deposits.reduce((acc, d) => acc + d.shares, 0);
    const totalAmount = this.deposits.reduce(
      (acc, d) => acc + d.shares * d.price,
      0,
    );
    return totalAmount / totalShares;
  }

  getWAPSell() {
    const totalShares = this.withdrawals.reduce((acc, d) => acc + d.shares, 0);
    const totalAmount = this.withdrawals.reduce(
      (acc, d) => acc + d.shares * d.price,
      0,
    );
    return totalAmount / totalShares;
  }

  updateTpv(newTpv: number) {
    //console.log(`updateTpv ${newTpv}`);
    this.tpv = newTpv;
  }

  sharePrice(): number {
    return this.shares === 0 ? 1 : this.tpv / this.shares;
  }

  log() {
    console.log('---');
    console.log(this.getData());
  }

  getData() {
    const sharePrice = this.sharePrice();
    return {
      shares: this.shares.toFixed(CONFIG.usdPrecision),
      tpv: this.tpv.toFixed(CONFIG.usdPrecision),
      sharePrice: sharePrice.toFixed(CONFIG.usdPrecision),
      wapBuy: this.wapBuy.toFixed(CONFIG.usdPrecision),
      wapSell: this.wapSell.toFixed(CONFIG.usdPrecision),
      realizedPnl: parseFloat(this.realizedPnl.toFixed(0)),
      realizedPnlPercentage:
        parseFloat(((this.wapSell / this.wapBuy - 1) * 100).toFixed(2)) * 100,
      unrealizedPnl: parseFloat(
        (this.tpv - this.shares * this.wapBuy).toFixed(0),
      ),
      unrealizedPnlPercentage:
        parseFloat(((sharePrice / this.wapBuy - 1) * 100).toFixed(2)) * 100,
    };
  }
}

type TokensWithIncludes = ({
  prices: {
    id: string;
    tokenId: string;
    price: string;
    blockNumber: number;
  }[];
} & {
  id: string;
  name: string;
  symbol: string;
  decimals: number;
  logoUrl: string;
})[];

@Injectable()
export class TradersService {
  constructor(
    private prisma: PrismaService,
    private downloader: DownloaderService,
  ) {}

  async getTrader(address: string) {
    let trader = await this.prisma.traders.findUnique({
      select: {
        id: true,
        address: true,
      },
      where: {
        address,
      },
    });

    if (!trader) {
      trader = await this.registerTrader(address);
    }

    const { tpv, portfolio } = await this.downloader.syncTrader(trader);

    const data = await this.analyzeTrader(trader.id, tpv);

    return await this.prisma.traders.update({
      where: {
        id: trader.id,
      },
      data: {
        portfolio,
        ...data,
      },
    });
  }

  async analyzeTrader(traderId: string, currentTpv: number) {
    const firstPriceHistoryRecord = await this.prisma.prices.findFirst({
      select: {
        blockNumber: true,
      },
      where: {
        tokenId: CONFIG.weth,
      },
      orderBy: {
        blockNumber: 'asc',
      },
    });

    if (!firstPriceHistoryRecord) {
      throw Error('No price history records found. Impossible to analyze');
    }

    const operations = await this.prisma.operations.findMany({
      include: {
        transaction: {
          select: {
            hash: true,
          },
        },
      },
      where: {
        traderId,
        blockNumber: {
          gte: firstPriceHistoryRecord.blockNumber,
        },
      },
      orderBy: [{ blockNumber: 'asc' }, { transactionIndex: 'asc' }],
    });

    if (operations.length > 0) {
      const uniqueTokens = new Set<string>();
      for (const operation of operations) {
        const portfolio = operation.portfolio as Portfolio;
        for (const token in portfolio) {
          if (token === NATIVE) {
            uniqueTokens.add(CONFIG.weth);
          } else {
            uniqueTokens.add(token);
          }
        }
      }

      const fund = new Fund();
      let totalGasUsd = 0;

      const tokens: TokensWithIncludes = await this.prisma.tokens.findMany({
        include: {
          prices: {
            orderBy: {
              blockNumber: 'desc',
            },
          },
        },
        where: {
          id: {
            in: Array.from(uniqueTokens),
          },
        },
      });

      for (let i = 0; i < operations.length; i++) {
        const prevOperation = i === 0 ? null : operations[i - 1];
        const operation = operations[i];
        const portfolio = operation.portfolio as Portfolio;
        const prevPortfolio = prevOperation
          ? (prevOperation.portfolio as Portfolio)
          : {};
        const { blockNumber, gasPaid } = operation;
        //console.log(blockNumber, 'blockNumber');
        //console.log(operation.transaction.hash, 'hash');

        const dataBefore = this.getPricedPortfolio(
          prevPortfolio,
          tokens,
          blockNumber,
        );
        const dataAfter = this.getPricedPortfolio(
          portfolio,
          tokens,
          blockNumber,
        );

        const tpvBefore = dataBefore.tpv;
        const tpvAfter = dataAfter.tpv;

        const wethData = tokens.find((t) => t.id === CONFIG.weth);
        const wethPrice =
          wethData.prices.find((p) => p.blockNumber <= blockNumber)?.price ||
          '0';

        const gasPaidUsd =
          parseFloat(ethers.formatEther(gasPaid)) * parseFloat(wethPrice);
        totalGasUsd += gasPaidUsd;

        if (fund.shares === 0 && tpvAfter > 0) {
          fund.deposit(tpvAfter);
        } else {
          fund.updateTpv(tpvBefore);
          const deltaTpv = tpvAfter - tpvBefore + gasPaidUsd;
          if (deltaTpv > 0.0000001) {
            if (deltaTpv - gasPaidUsd > 0.0000001) {
              fund.deposit(deltaTpv - gasPaidUsd);
            } else {
              fund.deposit(deltaTpv);
            }
          } else if (deltaTpv < -0.0000001) {
            if (deltaTpv + gasPaidUsd < -0.0000001) {
              fund.withdraw(Math.abs(deltaTpv) + gasPaidUsd);
            } else {
              fund.withdraw(Math.abs(deltaTpv));
            }
          }
          fund.updateTpv(tpvAfter);
        }

        //console.log(`Fund shares: ${fund.shares}, TPV: ${fund.tpv}`);

        // if (i === 10) {
        //   const filteredPortfolioBefore = {};
        //   const filteredPortfolioAfter = {};

        //   for (const token in dataBefore.portfolio) {
        //     if (dataBefore.portfolio[token].value > 0) {
        //       filteredPortfolioBefore[token] = dataBefore.portfolio[token];
        //     }
        //   }

        //   for (const token in dataAfter.portfolio) {
        //     if (dataAfter.portfolio[token].value > 0) {
        //       filteredPortfolioAfter[token] = dataAfter.portfolio[token];
        //     }
        //   }
        //   console.log(tpvBefore, 'tpvBefore');
        //   console.log(filteredPortfolioBefore, 'filteredPortfolioBefore');
        //   console.log(tpvAfter, 'tpvAfter');
        //   console.log(filteredPortfolioAfter, 'filteredPortfolioAfter');
        //   console.log(wethPrice, 'wethPrice');
        //   console.log(fund.shares, 'fund shares');
        //   break;
        // }
      }

      fund.updateTpv(currentTpv);

      return {
        totalGas: totalGasUsd.toFixed(CONFIG.usdPrecision),
        ...fund.getData(),
      };
    }
  }

  getPricedPortfolio(
    portfolio: Portfolio,
    tokens: TokensWithIncludes,
    blockNumber: number,
  ): { tpv: number; portfolio: PricedPortfolio } {
    let tpv = 0;
    const pricedPortfolio: PricedPortfolio = {};

    for (const token in portfolio) {
      const { amount, decimals } = portfolio[token];
      const tokenId = token === NATIVE ? CONFIG.weth : token;
      const tokenData = tokens.find((t) => t.id === tokenId);

      if (!tokenData) {
        throw Error(`Token ${tokenId} not found`);
      }

      const price = CONFIG.usdTokens.includes(tokenId)
        ? '1'
        : tokenData.prices.find((p) => p.blockNumber <= blockNumber)?.price ||
          '0';

      const amountNumber = Number(ethers.formatUnits(amount, decimals));
      if (amountNumber < 0) {
        console.log(token, 'token');
        console.log(amountNumber, 'amountNumber');
        throw Error('Negative amount');
      }
      const value = parseFloat(price) * amountNumber;
      tpv += value;
      pricedPortfolio[token] = {
        amount,
        decimals,
        price: parseFloat(price),
        value,
      };
    }

    return { tpv, portfolio: pricedPortfolio };
  }

  async getTop(count: number) {
    return await this.prisma.traders.findMany({
      where: {
        unrealizedPnl: {
          not: null,
        },
      },
      orderBy: {
        unrealizedPnl: 'desc',
      },
      take: count,
    });
  }

  async registerTrader(address: string) {
    return await this.prisma.traders.create({
      select: {
        id: true,
        address: true,
      },
      data: {
        address,
      },
    });
  }

  async debug() {
    return 'debug 3';
  }
}
