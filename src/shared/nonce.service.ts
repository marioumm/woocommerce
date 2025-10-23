import { Injectable, Logger } from '@nestjs/common';

@Injectable()
export class NonceService {
  private readonly logger = new Logger(NonceService.name);

  /**
   * Generate a simple nonce token for development
   * In production, you should use a more robust method or get from WordPress
   */
  generateNonce(): string {
    return Math.random().toString(36).substring(2) + Date.now().toString(36);
  }

  /**
   * For development, you can disable nonce checks in WooCommerce
   * by adding this to your WordPress functions.php:
   * add_filter('woocommerce_store_api_disable_nonce_check', '__return_true');
   */
  generateDevNonce(): string {
    return 'dev-nonce-' + Date.now();
  }
}
