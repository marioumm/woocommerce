/* eslint-disable prefer-const */
/* eslint-disable @typescript-eslint/no-unsafe-argument */
/* eslint-disable @typescript-eslint/no-unsafe-call */
/* eslint-disable @typescript-eslint/no-unsafe-return */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */

import {
  Injectable,
  Logger,
  HttpException,
  HttpStatus,
  OnModuleInit,
  OnModuleDestroy,
} from '@nestjs/common';
import { WooCommerceHttpService } from '../shared/woocommerce-http.service';
import { ProductQueryDto } from './dto/prodcut-query.dto';
import { TranslationService } from './translation.service';
import axios, { AxiosResponse } from 'axios';
import Redis from 'ioredis';

@Injectable()
export class ProductsService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(ProductsService.name);
  private existFlag = false;
  private redis: Redis;
  private readonly productCacheTTL = 300;
  private readonly productListCacheTTL = 180;
  private readonly customerCacheTTL = 3600 * 24; // 1 day
  private readonly userServiceBaseUrl =
    process.env.USER_SERVICE_BASE_URL || 'https://api-gateway.camion-app.com';

  constructor(
    private readonly httpService: WooCommerceHttpService,
    private readonly translationService: TranslationService,
  ) {}

  async onModuleInit() {
    try {
      this.redis = new Redis({
        host: process.env.REDIS_HOST || 'localhost',
        port: Number(process.env.REDIS_PORT) || 6379,
        password: process.env.REDIS_PASSWORD || undefined,
        retryStrategy: (times) => {
          const delay = Math.min(times * 50, 2000);
          return delay;
        },
      });

      this.redis.on('connect', () => {
        this.logger.log('✅ Redis connected successfully');
      });

      this.redis.on('error', (err) => {
        this.logger.error('❌ Redis connection error:', err);
      });
    } catch (error) {
      this.logger.error('Failed to initialize Redis:', error);
    }
  }

  async onModuleDestroy() {
    if (this.redis) {
      await this.redis.quit();
      this.logger.log('Redis connection closed');
    }
  }

  private extractLanguage(headers?: any): string {
    const acceptLanguage =
      headers?.['accept-language'] || headers?.['Accept-Language'];
    if (acceptLanguage) {
      return acceptLanguage.split('-')[0].toLowerCase();
    }
    return 'en';
  }

  /**
   * Helper to check if a product exists in wishlist/cart, with 500 fallback.
   */
  private async checkIfExistsIn(
    type: 'wishlist' | 'cart',
    productId: string,
    headers: Record<string, string>,
  ): Promise<boolean> {
    const url = `${this.userServiceBaseUrl}/${type}/check-product`;
    try {
      const response: AxiosResponse<{ exists: boolean }> = await axios.post(
        url,
        { productId },
        { headers },
      );
      if (!response.data.exists) {
        this.existFlag = true;
      }
      return response.data.exists || false;
    } catch (err: any) {
      if (err?.response?.status === 500) {
        this.logger.warn(
          `${type} service returned 500 — assuming not in ${type}`,
        );
      }
      return false;
    }
  }

  private async checkIfPurchasedFromWoo(
    productId: string,
    customerEmail: string,
  ): Promise<boolean> {
    try {
      // Try to get customer ID from cache first
      const customerCacheKey = `customer:email:${customerEmail}`;
      let customerId: number | null = null;

      const cachedCustomerId = await this.redis.get(customerCacheKey);
      if (cachedCustomerId) {
        customerId = parseInt(cachedCustomerId, 10);
        this.logger.debug(
          `Customer ID for ${customerEmail} retrieved from cache`,
        );
      } else {
        // Fetch customer ID from WooCommerce API
        const customerResponse = await this.httpService.get(
          `/customers?email=${encodeURIComponent(customerEmail)}`,
          undefined,
          true,
          'V3',
        );

        if (!customerResponse.data || customerResponse.data.length === 0) {
          return false;
        }

        customerId = customerResponse.data[0]?.id;
        if (!customerId) {
          return false;
        }

        // Cache the customer ID
        await this.redis.setex(
          customerCacheKey,
          this.customerCacheTTL,
          customerId.toString(),
        );
        this.logger.debug(`Customer ID for ${customerEmail} cached`);
      }

      // Now query orders with customer ID
      const ordersResponse = await this.httpService.get(
        `/orders?customer=${customerId}&status=completed`,
        undefined,
        true,
        'V3',
      );

      if (!ordersResponse.data || ordersResponse.data.length === 0) {
        return false;
      }

      const purchased = ordersResponse.data.some((order: any) =>
        order.line_items?.some(
          (item: any) => String(item.product_id) === String(productId),
        ),
      );

      return purchased;
    } catch (error) {
      this.logger.error('Error checking purchase from WooCommerce:', error);
      return false;
    }
  }

  private safeParse = (val: any) =>
    isNaN(parseFloat(val)) ? 0 : parseFloat(val);

  private transformProductPrices(product: any, multiplier = 5) {
    if (!product?.prices) return product;

    const price = this.safeParse(product.prices.price) * multiplier;
    const regularPrice =
      this.safeParse(product.prices.regular_price) * multiplier;
    const salePrice = this.safeParse(product.prices.sale_price) * multiplier;

    return {
      ...product,
      prices: {
        ...product.prices,
        price: (price / 100).toFixed(2),
        regular_price: (regularPrice / 100).toFixed(2),
        sale_price: (salePrice / 100).toFixed(2),
      },
    };
  }

  private async recordProductView(productId: string): Promise<number> {
    try {
      if (!this.redis) {
        this.logger.warn('Redis not available, returning 0 views');
        return 0;
      }

      const key = `product:${productId}:views`;
      await this.redis.incr(key);
      const count = await this.redis.get(key);
      return count ? parseInt(count) : 0;
    } catch (error) {
      this.logger.error(
        `Failed to record view for product ${productId}:`,
        error,
      );
      return 0;
    }
  }

  private async getProductViewCount(productId: string): Promise<number> {
    try {
      if (!this.redis) {
        return 0;
      }

      const key = `product:${productId}:views`;
      const count = await this.redis.get(key);
      return count ? parseInt(count) : 0;
    } catch (error) {
      this.logger.error(
        `Failed to get view count for product ${productId}:`,
        error,
      );
      return 0;
    }
  }

  private async getProductsViewCounts(
    productIds: string[],
  ): Promise<Map<string, number>> {
    const viewMap = new Map<string, number>();

    try {
      if (!this.redis || !productIds.length) {
        return viewMap;
      }

      const pipeline = this.redis.pipeline();
      productIds.forEach((id) => {
        pipeline.get(`product:${id}:views`);
      });

      const results = await pipeline.exec();

      if (results) {
        results.forEach((result, index) => {
          const count = parseInt((result[1] as string) || '0', 10);
          viewMap.set(productIds[index], count);
        });
      }

      return viewMap;
    } catch (error) {
      this.logger.error('Failed to get view counts:', error);
      return viewMap;
    }
  }
  private async getFromCache<T>(key: string): Promise<T | null> {
    try {
      if (!this.redis) {
        return null;
      }
      const value = await this.redis.get(key);
      if (!value) {
        return null;
      }
      return JSON.parse(value) as T;
    } catch (error) {
      this.logger.error(`Failed to get cache for key ${key}:`, error);
      return null;
    }
  }

  private async setCache(
    key: string,
    value: any,
    ttlSeconds: number,
  ): Promise<void> {
    try {
      if (!this.redis) {
        return;
      }
      const payload = JSON.stringify(value);
      if (ttlSeconds > 0) {
        await this.redis.set(key, payload, 'EX', ttlSeconds);
      } else {
        await this.redis.set(key, payload);
      }
    } catch (error) {
      this.logger.error(`Failed to set cache for key ${key}:`, error);
    }
  }

  private buildProductsCacheKey(
    params: string,
    perPage: number,
    page: number,
    language?: string,
  ): string {
    const lang = language || 'en';
    return `products:list:${lang}:p${page}:pp${perPage}:${params}`;
  }

  async getProduct(id: string, token: string, language?: string) {
    try {
      const cacheKey = `product:details:${id}:${language || 'en'}`;
      let productData = await this.getFromCache<any>(cacheKey);

      if (!productData) {
        let response = await this.httpService.get(`/products/${id}`);
        const { data: variations } = await this.httpService.get(
          `/products/${id}/variations`,
          undefined,
          true,
          'V3',
        );

        if (variations && Array.isArray(variations)) {
          response.data['variations'] = variations.map((v) => ({
            id: v.id,
            attributes:
              v.attributes?.map((attr) => ({
                name: attr.name,
                option: attr.option,
              })) || [],
            image: v.image?.src || null,
            price: this.safeParse(v.price) * 5 || null,
            regular_price: this.safeParse(v.regular_price) * 5 || null,
            sale_price: this.safeParse(v.sale_price) * 5 || null,
            stock_quantity: v.stock_quantity ?? null,
            stock_status: v.stock_status || null,
          }));
        }

        productData = this.transformProductPrices(response.data);

        if (language && language !== 'en') {
          productData = await this.translationService.translateProduct(
            productData,
            language,
          );
        }

        await this.setCache(cacheKey, productData, this.productCacheTTL);
      }

      const viewCount = await this.recordProductView(id);

      this.logger.log(`Product #${id} details fetched successfully`);

      const authHeaders = {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      };

      let customerEmail = '';
      try {
        const userResponse = await axios.get(
          `${this.userServiceBaseUrl}/users/me`,
          {
            headers: authHeaders,
          },
        );
        customerEmail = userResponse.data?.email || '';
      } catch (err) {
        this.logger.warn('Failed to get user email');
      }

      const [wishlist, cart, isPurchased] = await Promise.all([
        this.checkIfExistsIn('wishlist', id, authHeaders),
        this.checkIfExistsIn('cart', id, authHeaders),
        customerEmail
          ? this.checkIfPurchasedFromWoo(id, customerEmail)
          : Promise.resolve(false),
      ]);

      return {
        ...productData,
        wishlist,
        cart,
        isPurchased,
        viewCount,
        reviewsCount: productData?.rating_count || 0,
        averageRating: parseFloat(productData?.average_rating || '0'),
        language: language || 'en',
        ...(this.existFlag
          ? {}
          : {
              message: 'Check Local Server, Item might be in wishlist or cart',
            }),
      };
    } catch (error) {
      this.logger.error(`Error fetching product #${id}: ${error?.message}`);
      if (error.response?.status === 404) {
        throw new HttpException('Product not found', HttpStatus.NOT_FOUND);
      }
      throw new HttpException(
        {
          error: 'Failed to fetch product',
          details: error.response?.data || error.message,
        },
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  async getProduct_Sync(id: string, language?: string) {
    try {
      const cacheKey = `product:details:${id}:${language || 'en'}`;
      let productData = await this.getFromCache<any>(cacheKey);

      if (!productData) {
        let response = await this.httpService.get(`/products/${id}`);
        const { data: variations } = await this.httpService.get(
          `/products/${id}/variations`,
          undefined,
          true,
          'V3',
        );

        if (variations && Array.isArray(variations)) {
          response.data['variations'] = variations.map((v) => ({
            id: v.id,
            attributes:
              v.attributes?.map((attr) => ({
                name: attr.name,
                option: attr.option,
              })) || [],
            image: v.image?.src || null,
            price: this.safeParse(v.price) * 5 || null,
            regular_price: this.safeParse(v.regular_price) * 5 || null,
            sale_price: this.safeParse(v.sale_price) * 5 || null,
            stock_quantity: v.stock_quantity ?? null,
            stock_status: v.stock_status || null,
          }));
        }

        productData = this.transformProductPrices(response.data);

        if (language && language !== 'en') {
          productData = await this.translationService.translateProduct(
            productData,
            language,
          );
        }

        await this.setCache(cacheKey, productData, this.productCacheTTL);
      }

      const viewCount = await this.getProductViewCount(id);

      this.logger.log(`Product #${id} details fetched successfully`);
      return {
        ...productData,
        viewCount,
        reviewsCount: productData?.rating_count || 0,
        averageRating: parseFloat(productData?.average_rating || '0'),
        language: language || 'en',
      };
    } catch (error) {
      this.logger.error(`Error fetching product #${id}: ${error?.message}`);
      if (error.response?.status === 404) {
        throw new HttpException('Product not found', HttpStatus.NOT_FOUND);
      }
      throw new HttpException(
        {
          error: 'Failed to fetch product',
          details: error.response?.data || error.message,
        },
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  async getProducts(query: ProductQueryDto, language?: string) {
    try {
      const params = new URLSearchParams();
      const { min_price, max_price, search, ...filteredQuery } = query;

      let searchTerm = search;
      if (search && language && language !== 'en') {
        try {
          searchTerm = await this.translationService.translateToEnglish(search);
        } catch (err) {
          this.logger.warn(
            `Search translation failed, using original: ${search}`,
          );
        }
      }

      Object.entries(filteredQuery).forEach(([key, value]) => {
        if (value) params.append(key, String(value));
      });

      if (searchTerm) {
        params.append('search', searchTerm);
      }

      const perPage = parseInt(query.per_page ?? '10');
      const currentPage = parseInt(query.page ?? '1');

      const cacheKey = this.buildProductsCacheKey(
        params.toString(),
        perPage,
        currentPage,
        language,
      );
      const cached = await this.getFromCache<any>(cacheKey);
      if (cached) {
        return cached;
      }

      const fetchProducts = async (perPageValue: number, page: number) => {
        const response = await this.httpService.get(
          `/products?${params.toString()}&per_page=${perPageValue}&page=${page}`,
        );
        return response;
      };

      let response = await fetchProducts(perPage, currentPage);
      let originalProducts = response.data;

      let filteredProducts = originalProducts.filter((product: any) => {
        const rawPrice = parseFloat(product.prices?.price ?? '0');
        const hasImages =
          Array.isArray(product.images) && product.images.length > 0;
        if (rawPrice <= 0 || !hasImages) return false;

        const withinMin = min_price ? rawPrice >= parseFloat(min_price) : true;
        const withinMax = max_price ? rawPrice <= parseFloat(max_price) : true;
        return withinMin && withinMax;
      });

      let badCount = perPage - filteredProducts.length;
      let nextPage = currentPage + 1;

      while (
        badCount > 0 &&
        nextPage <= parseInt(response.headers['x-wp-totalpages'] ?? '1')
      ) {
        const extraResponse = await fetchProducts(badCount + 30, nextPage);

        const extraProducts = extraResponse.data.filter((product: any) => {
          const rawPrice = parseFloat(product.prices?.price ?? '0');
          const hasImages =
            Array.isArray(product.images) && product.images.length > 0;
          if (rawPrice <= 0 || !hasImages) return false;

          const withinMin = min_price
            ? rawPrice >= parseFloat(min_price)
            : true;
          const withinMax = max_price
            ? rawPrice <= parseFloat(max_price)
            : true;
          return withinMin && withinMax;
        });

        this.logger.debug(
          `Fetched page ${nextPage}, got ${extraProducts.length} valid products`,
        );

        filteredProducts = [...filteredProducts, ...extraProducts];
        badCount = perPage - filteredProducts.length;
        nextPage++;
      }

      let modifiedProducts = filteredProducts
        .slice(0, perPage)
        .map((product) => this.transformProductPrices(product));

      const productIds = modifiedProducts.map((p) => String(p.id));
      const viewCounts = await this.getProductsViewCounts(productIds);

      modifiedProducts = modifiedProducts.map((product) => ({
        ...product,
        viewCount: viewCounts.get(String(product.id)) || 0,
        reviewsCount: product.rating_count || 0,
        averageRating: parseFloat(product.average_rating || '0'),
      }));

      if (language && language !== 'en') {
        modifiedProducts = await Promise.all(
          modifiedProducts.map((product) =>
            this.translationService.translateProduct(product, language),
          ),
        );
      }

      const result = {
        products: modifiedProducts,
        pagination: {
          total: parseInt(response.headers['x-wp-total']) || 0,
          totalPages: parseInt(response.headers['x-wp-totalpages']) || 1,
          currentPage: parseInt(query.page ?? '1'),
          perPage: parseInt(query.per_page ?? '10'),
        },
        language: language || 'en',
      };

      await this.setCache(cacheKey, result, this.productListCacheTTL);

      return result;
    } catch (error) {
      this.logger.error(`Error fetching products: ${error?.message}`);
      throw new HttpException(
        {
          error: 'Failed to fetch products',
          details: error.response?.data || error.message,
        },
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  async getProductAttributes(id: string) {
    try {
      const response = await this.httpService.get(`/products/attributes/${id}`);
      return response.data;
    } catch (error) {
      this.logger.error('Error fetching product attributes:', error.message);
      throw new HttpException(
        'Failed to fetch product attributes',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  async getProductsAttributes() {
    try {
      const response = await this.httpService.get('/products/attributes');
      return response.data;
    } catch (error) {
      this.logger.error('Error fetching product attributes:', error.message);
      throw new HttpException(
        'Failed to fetch product attributes',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  async getProductReviews(productId?: string) {
    try {
      const endpoint = productId
        ? `/products/reviews?product=${productId}`
        : '/products/reviews';
      const response = await this.httpService.get(endpoint);

      return response.data;
    } catch (error) {
      this.logger.error('Error fetching product reviews:', error.message);
      throw new HttpException(
        'Failed to fetch product reviews',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  async createProductReview(reviewData: {
    product_id: number;
    review: string;
    reviewer: string;
    reviewer_email: string;
    rating: number;
    status?: string;
  }) {
    try {
      const response = await this.httpService.post(
        '/products/reviews',
        reviewData,
        undefined,
        true,
        'V3',
      );
      return response.data;
    } catch (error) {
      this.logger.error('Error creating product review:', error.message);
      throw new HttpException(
        {
          error: 'Failed to create product review',
          details: error.response?.data || error.message,
        },
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  async getProductReview(reviewId: string) {
    try {
      const response = await this.httpService.get(
        `/products/reviews/${reviewId}`,
        undefined,
        true,
        'V3',
      );
      return response.data;
    } catch (error) {
      this.logger.error('Error fetching product review:', error.message);
      if (error.response?.status === 404) {
        throw new HttpException(
          'Product review not found',
          HttpStatus.NOT_FOUND,
        );
      }
      throw new HttpException(
        {
          error: 'Failed to fetch product review',
          details: error.response?.data || error.message,
        },
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  async updateProductReview(
    reviewId: string,
    updateData: {
      review?: string;
      reviewer?: string;
      reviewer_email?: string;
      rating?: number;
      status?: string;
    },
  ) {
    try {
      const response = await this.httpService.put(
        `/products/reviews/${reviewId}`,
        updateData,
        undefined,
        true,
        'V3',
      );
      return response.data;
    } catch (error) {
      this.logger.error('Error updating product review:', error.message);
      if (error.response?.status === 404) {
        throw new HttpException(
          'Product review not found',
          HttpStatus.NOT_FOUND,
        );
      }
      throw new HttpException(
        {
          error: 'Failed to update product review',
          details: error.response?.data || error.message,
        },
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  async deleteProductReview(reviewId: string, force: boolean = true) {
    try {
      const url = force
        ? `/products/reviews/${reviewId}?force=true`
        : `/products/reviews/${reviewId}`;
      const response = await this.httpService.delete(
        url,
        undefined,
        true,
        'V3',
      );
      return response.data;
    } catch (error) {
      this.logger.error('Error deleting product review:', error.message);
      if (error.response?.status === 404) {
        throw new HttpException(
          'Product review not found',
          HttpStatus.NOT_FOUND,
        );
      }
      throw new HttpException(
        {
          error: 'Failed to delete product review',
          details: error.response?.data || error.message,
        },
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  async batchUpdateProductReviews(batchData: {
    create?: Array<{
      product_id: number;
      review: string;
      reviewer: string;
      reviewer_email: string;
      rating: number;
    }>;
    update?: Array<{
      id: number;
      review?: string;
      reviewer?: string;
      reviewer_email?: string;
      rating?: number;
      status?: string;
    }>;
    delete?: number[];
  }) {
    try {
      const response = await this.httpService.post(
        '/products/reviews/batch',
        batchData,
      );
      return response.data;
    } catch (error) {
      this.logger.error('Error batch updating product reviews:', error.message);
      throw new HttpException(
        {
          error: 'Failed to batch update product reviews',
          details: error.response?.data || error.message,
        },
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }
}
