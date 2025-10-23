import { Test, TestingModule } from '@nestjs/testing';
import { WooCommerceshippingService } from './woo-commerceshipping.service';

describe('WooCommerceshippingService', () => {
  let service: WooCommerceshippingService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [WooCommerceshippingService],
    }).compile();

    service = module.get<WooCommerceshippingService>(WooCommerceshippingService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
