/* eslint-disable @typescript-eslint/no-unsafe-return */
import { Controller, Get, Param, ParseIntPipe, Query, Headers } from '@nestjs/common';
import { CategoriesService } from './categories.service';

@Controller('api/categories')
export class CategoriesController {
  constructor(private readonly categoriesService: CategoriesService) {}

  @Get()
  async getCategories(
    @Query('lang') queryLang?: string,
    @Headers('accept-language') acceptLanguage?: string,
  ) {
    const lang = queryLang || this.extractLanguage(acceptLanguage);
    return this.categoriesService.getCategories(lang);
  }

  @Get('main')
  async getMainCategories(
    @Query('lang') queryLang?: string,
    @Headers('accept-language') acceptLanguage?: string,
  ) {
    const lang = queryLang || this.extractLanguage(acceptLanguage);
    return this.categoriesService.getMainCategories(lang);
  }

  @Get('product-tags')
  async getProductTags(
    @Query('lang') queryLang?: string,
    @Headers('accept-language') acceptLanguage?: string,
  ) {
    const lang = queryLang || this.extractLanguage(acceptLanguage);
    return this.categoriesService.getProductTags(lang);
  }

  @Get('product-brands')
  async getProductBrands(
    @Query('lang') queryLang?: string,
    @Headers('accept-language') acceptLanguage?: string,
  ) {
    const lang = queryLang || this.extractLanguage(acceptLanguage);
    return this.categoriesService.getProductBrands(lang);
  }

  @Get(':id')
  async getCategoryWithSubcategories(
    @Param('id', ParseIntPipe) id: number,
    @Query('lang') queryLang?: string,
    @Headers('accept-language') acceptLanguage?: string,
  ) {
    const lang = queryLang || this.extractLanguage(acceptLanguage);
    return await this.categoriesService.getCategoryWithSubcategories(id, lang);
  }

  private extractLanguage(acceptLanguage?: string): string {
    if (!acceptLanguage) return 'en';
    const lang = acceptLanguage.split(',')[0].split('-')[0].trim();
    return lang || 'en';
  }
}
