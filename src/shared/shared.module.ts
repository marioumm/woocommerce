import { Module, Global } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { WooCommerceHttpService } from './woocommerce-http.service';
import { NonceService } from './nonce.service';

@Global()
@Module({
  imports: [HttpModule],
  providers: [WooCommerceHttpService, NonceService],
  exports: [WooCommerceHttpService, NonceService],
})
export class SharedModule {}
