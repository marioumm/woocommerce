import { Module } from '@nestjs/common';
import { SharedModule } from '../shared/shared.module'; 
import { TrackingController } from './tracking.controller';
import { WooCommerceTrackingService } from './woocommerce-tracking.service';

@Module({
  imports: [
    SharedModule, 
  ],
  controllers: [
    TrackingController,
  ],
  providers: [
    WooCommerceTrackingService,
  ],
  exports: [
    WooCommerceTrackingService, 
  ],
})
export class TrackingModule {}
