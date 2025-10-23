import { Injectable, Logger } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { ConfigService } from '@nestjs/config';
import { AxiosResponse, AxiosRequestConfig } from 'axios';
import { firstValueFrom } from 'rxjs';

@Injectable()
export class WooCommerceHttpService {
  private readonly logger = new Logger(WooCommerceHttpService.name);
  private readonly baseUrl: Record<'V1' | 'V3', string>;

  constructor(
    private readonly httpService: HttpService,
    private readonly configService: ConfigService,
  ) {
    this.baseUrl = {
      V1: this.configService.get<string>(
        'WOOCOMMERCE_BASE_URL_V1',
        'https://pro-get.camion-app.com/wp-json/wc/store/v1',
      ),
      V3: this.configService.get<string>(
        'WOOCOMMERCE_BASE_URL_V3',
        'https://pro-get.camion-app.com/wp-json/wc/v3',
      ),
    };
  }

  async get(
    endpoint: string,
    cartToken?: string,
    useBasicAuth = true,
    baseURL: 'V1' | 'V3' = 'V1',
  ): Promise<AxiosResponse> {
    return this.request(
      'get',
      endpoint,
      undefined,
      cartToken,
      useBasicAuth,
      baseURL,
    );
  }

  async post(
    endpoint: string,
    data: any,
    cartToken?: string,
    useBasicAuth = true,
    baseURL: 'V1' | 'V3' = 'V1',
  ): Promise<AxiosResponse> {
    return this.request(
      'post',
      endpoint,
      data,
      cartToken,
      useBasicAuth,
      baseURL,
    );
  }

  async put(
    endpoint: string,
    data: any,
    cartToken?: string,
    useBasicAuth = true,
    baseURL: 'V1' | 'V3' = 'V1',
  ): Promise<AxiosResponse> {
    return this.request(
      'put',
      endpoint,
      data,
      cartToken,
      useBasicAuth,
      baseURL,
    );
  }

  async delete(
    endpoint: string,
    cartToken?: string,
    useBasicAuth = true,
    baseURL: 'V1' | 'V3' = 'V1',
  ): Promise<AxiosResponse> {
    return this.request(
      'delete',
      endpoint,
      undefined,
      cartToken,
      useBasicAuth,
      baseURL,
    );
  }

  private async request(
    method: 'get' | 'post' | 'put' | 'delete',
    endpoint: string,
    data?: any,
    cartToken?: string,
    useBasicAuth = true,
    baseURL: 'V1' | 'V3' = 'V1',
  ): Promise<AxiosResponse> {
    const config: AxiosRequestConfig = {
      headers: this.buildHeaders(cartToken, !!data, useBasicAuth),
    };

    try {
      const url = `${this.baseUrl[baseURL]}${endpoint}`;      
      switch (method) {
        case 'get':
          return await firstValueFrom(this.httpService.get(url, config));
        case 'post':
          return await firstValueFrom(this.httpService.post(url, data, config));
        case 'put':
          return await firstValueFrom(this.httpService.put(url, data, config));
        case 'delete':
          return await firstValueFrom(this.httpService.delete(url, config));
      }
    } catch (error) {
      this.logger.error(
        `HTTP ${method.toUpperCase()} request to ${endpoint} failed:`,
        error.message,
      );
      throw error;
    }
  }

  private buildHeaders(
    cartToken?: string,
    requiresAuth = false,
    useBasicAuth = false,
  ): Record<string, string> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };

    if (cartToken) headers['Cart-Token'] = cartToken;

    if (useBasicAuth) {
      const consumerKey = this.configService.get<string>(
        'WOOCOMMERCE_CONSUMER_KEY',
      );
      const consumerSecret = this.configService.get<string>(
        'WOOCOMMERCE_CONSUMER_SECRET',
      );
      const authString = Buffer.from(
        `${consumerKey}:${consumerSecret}`,
      ).toString('base64');
      headers['Authorization'] = `Basic ${authString}`;
    } else if (requiresAuth && !cartToken) {
      headers['Nonce'] = this.generateDevNonce();
    }

    return headers;
  }

  private generateDevNonce(): string {
    return 'dev-nonce-' + Date.now();
  }

  /**
   * Initializes a WooCommerce cart session and returns the cart token.
   */
  async initializeCartSession(): Promise<string | null> {
    try {
      const response = await this.get('/cart');
      return response.headers['cart-token'] || null;
    } catch (error) {
      this.logger.error('Failed to initialize cart session:', error.message);
      return null;
    }
  }
}
