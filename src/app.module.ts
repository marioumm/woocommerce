import { ConfigModule } from '@nestjs/config';
import { CategoriesModule } from './categories/categories.module';
import { HealthModule } from './health/health.module';
import { ProductsModule } from './products/products.module';
import { SharedModule } from './shared/shared.module';
import { Module } from '@nestjs/common';
import { CheckoutService } from './checkout/checkout.service';
import { CheckoutController } from './checkout/checkout.controller';
import { CheckoutModule } from './checkout/checkout.module';
import { WooCommerceShippingModule } from './woo-commerceshipping/woo-commerceshipping.module';
import { WooCommerceShippingService } from './woo-commerceshipping/woo-commerceshipping.service';
import { WooCommerceShippingController } from './woo-commerceshipping/woo-commerceshipping.controller';
import { TrackingModule } from './tracking/tracking.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
    }),
    SharedModule,
    HealthModule, 
    ProductsModule,
    CategoriesModule,
    CheckoutModule,
    WooCommerceShippingModule,
    TrackingModule
  ],
  providers: [CheckoutService, WooCommerceShippingService],
  controllers: [CheckoutController, WooCommerceShippingController],
})
export class AppModule {}
