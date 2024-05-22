import { Test, TestingModule } from '@nestjs/testing';
import { Web3rpcService } from './web3rpc.service';

describe('Web3rpcService', () => {
  let service: Web3rpcService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [Web3rpcService],
    }).compile();

    service = module.get<Web3rpcService>(Web3rpcService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
