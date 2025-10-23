/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/no-unsafe-call */
/* eslint-disable @typescript-eslint/no-unsafe-return */
import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Put,
  Query,
  Request,
  Headers
} from '@nestjs/common';
import { ProductsService } from './products.service';
import { ProductQueryDto } from './dto/prodcut-query.dto';

@Controller('api/products')
export class ProductsController {
  constructor(private readonly productsService: ProductsService) {}

  @Get()
  async getProducts(
    @Query() query: ProductQueryDto,
    @Headers('accept-language') acceptLanguage?: string,
    @Query('lang') langQuery?: string
  ) {
    const language = langQuery || (acceptLanguage?.split('-')[0]) || 'en';
    return this.productsService.getProducts(query , language);
  }

  @Get('attributes')
  async getProductsAttributes() {
    return this.productsService.getProductsAttributes();
  }

  @Get('attributes/:id')
  async getProductAttributes(@Param('id') id: string) {
    return this.productsService.getProductAttributes(id);
  }

  @Get('reviews')
  async getProductReviews(@Query('product') productId?: string) {
    return this.productsService.getProductReviews(productId);
  }

  @Get(':id')
  async getProduct(
    @Param('id') id: string, 
    @Request() req: any,
    @Headers('accept-language') acceptLanguage?: string,
    @Query('lang') langQuery?: string
  ) {
    let token = req.headers['authorization']?.replace('Bearer ', '');
    if (!token) token = '';
    
    const language = langQuery || (acceptLanguage?.split('-')[0]) || 'en';
    return this.productsService.getProduct(id, token, language);
  }

 @Get('sync/:id')
  async getProductSync(
    @Param('id') id: string,
    @Headers('accept-language') acceptLanguage?: string,
    @Query('lang') langQuery?: string
  ) {
    const language = langQuery || (acceptLanguage?.split('-')[0]) || 'en';
    return this.productsService.getProduct_Sync(id, language);
  }

  /**
   * Create a new product review
   * POST /api/products/reviews
   */
  @Post('reviews')
  async createProductReview(
    @Body()
    reviewData: {
      product_id: number;
      review: string;
      reviewer: string;
      reviewer_email: string;
      rating: number;
      status?: string;
    },
  ) {
    return this.productsService.createProductReview(reviewData);
  }

  /**
   * Get a single product review by ID
   * GET /api/products/reviews/:id
   */
  @Get('reviews/:id')
  async getProductReview(@Param('id') id: string) {
    return this.productsService.getProductReview(id);
  }

  /**
   * Update a product review
   * PUT /api/products/reviews/:id
   */
  @Put('reviews/:id')
  async updateProductReview(
    @Param('id') id: string,
    @Body()
    updateData: {
      review?: string;
      reviewer?: string;
      reviewer_email?: string;
      rating?: number;
      status?: string;
    },
  ) {
    return this.productsService.updateProductReview(id, updateData);
  }

  /**
   * Delete a product review
   * DELETE /api/products/reviews/:id
   */
  @Delete('reviews/:id')
  async deleteProductReview(
    @Param('id') id: string,
    @Query('force') force?: string,
  ) {
    const forceDelete = force === 'true';
    return this.productsService.deleteProductReview(id, forceDelete);
  }

  /**
   * Batch update product reviews
   * POST /api/products/reviews/batch
   */
  @Post('reviews/batch')
  async batchUpdateProductReviews(
    @Body()
    batchData: {
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
    },
  ) {
    return this.productsService.batchUpdateProductReviews(batchData);
  }
}
