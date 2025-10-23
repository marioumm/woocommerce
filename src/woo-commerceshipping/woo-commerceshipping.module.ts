import { Module } from '@nestjs/common';
import { WooCommerceShippingController } from './woo-commerceshipping.controller';
import { WooCommerceShippingService } from './woo-commerceshipping.service';
import { WooCommerceHttpService } from 'src/shared/woocommerce-http.service';
import { HttpModule } from '@nestjs/axios';
import { ConfigModule } from '@nestjs/config';

@Module({
  imports: [
    HttpModule, 
    ConfigModule,
  ],
  controllers: [WooCommerceShippingController],
  providers: [WooCommerceShippingService, WooCommerceHttpService],
  exports: [WooCommerceShippingService], // Export if other modules need to use it
})
export class WooCommerceShippingModule {}
