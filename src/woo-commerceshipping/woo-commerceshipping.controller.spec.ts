import { Test, TestingModule } from '@nestjs/testing';
import { WooCommerceshippingController } from './woo-commerceshipping.controller';

describe('WooCommerceshippingController', () => {
  let controller: WooCommerceshippingController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [WooCommerceshippingController],
    }).compile();

    controller = module.get<WooCommerceshippingController>(WooCommerceshippingController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
