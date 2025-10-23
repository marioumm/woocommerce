/* eslint-disable @typescript-eslint/no-unsafe-call */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-return */
import { Injectable, Logger, HttpException, HttpStatus, NotFoundException } from '@nestjs/common';
import { WooCommerceHttpService } from '../shared/woocommerce-http.service';
import { TranslationService } from './translation.service';

export interface CategoryWithSubcategories {
  id: number;
  name: string;
  slug: string;
  description: string;
  parent: number;
  count: number;
  image: any;
  review_count: number;
  permalink: string;
  subcategories: CategoryWithSubcategories[];
}

@Injectable()
export class CategoriesService {
  private readonly logger = new Logger(CategoriesService.name);

  constructor(
    private readonly httpService: WooCommerceHttpService,
    private readonly translationService: TranslationService,
  ) {}

  async getMainCategories(lang?: string): Promise<CategoryWithSubcategories[]> {
    try {
      const response = await this.httpService.get('/products/categories');
      const mainCategories = response.data.filter(
        (cat: any) => cat.parent === 0
      );

      if (!lang || lang === 'en') {
        return mainCategories;
      }

      return await this.translateCategories(mainCategories, lang);
    } catch (error) {
      this.logger.error('Error fetching main categories:', error.message);
      throw new HttpException(
        'Failed to fetch main categories',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  async getProductsByCategory(categoryId: number) {
    try {
      const response = await this.httpService.get(`/products?category=${categoryId}`);
      return response.data;
    } catch (error) {
      this.logger.error('Error fetching products by category:', error.message);
      throw new HttpException(
        'Failed to fetch products by category',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  async getCategories(lang?: string) {
    try {
      const response = await this.httpService.get('/products/categories');
      const categories = response.data;

      if (!lang || lang === 'en') {
        return categories;
      }

      return await this.translateCategories(categories, lang);
    } catch (error) {
      this.logger.error('Error fetching categories:', error.message);
      throw new HttpException(
        'Failed to fetch categories',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  async getCategoryWithSubcategories(
    categoryId: number,
    lang?: string,
  ): Promise<CategoryWithSubcategories> {
    try {
      const categoryResponse = await this.httpService.get(`/products/categories/${categoryId}`);
      const category = categoryResponse.data;

      if (!category) {
        throw new NotFoundException(`Category with ID ${categoryId} not found`);
      }

      const allCategoriesResponse = await this.httpService.get('/products/categories');
      const allCategories = allCategoriesResponse.data;

      const subcategories = allCategories.filter(
        (cat: any) => cat.parent === categoryId
      );

      const categoryWithSubs = {
        ...category,
        subcategories: subcategories || []
      };

      if (!lang || lang === 'en') {
        return categoryWithSubs;
      }

      return await this.translateCategoryWithSubcategories(categoryWithSubs, lang);
    } catch (error) {
      this.logger.error(`Error fetching category ${categoryId}:`, error.message);

      if (error instanceof NotFoundException) {
        throw error;
      }

      throw new HttpException(
        `Failed to fetch category with ID ${categoryId}`,
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  async getProductTags(lang?: string) {
    try {
      const response = await this.httpService.get('/products/tags');
      const tags = response.data;

      if (!lang || lang === 'en') {
        return tags;
      }

      return await this.translateTags(tags, lang);
    } catch (error) {
      this.logger.error('Error fetching product tags:', error.message);
      throw new HttpException(
        'Failed to fetch product tags',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  async getProductBrands(lang?: string) {
    try {
      const response = await this.httpService.get('/products/brands');
      const brands = response.data;

      if (!lang || lang === 'en') {
        return brands;
      }

      return await this.translateBrands(brands, lang);
    } catch (error) {
      this.logger.error('Error fetching product brands:', error.message);
      throw new HttpException(
        'Failed to fetch product brands',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }


  private async translateCategories(categories: any[], lang: string) {
    try {
      const textsToTranslate: string[] = [];
      const textMap: { [key: string]: number } = {};
      let index = 0;

      categories.forEach((category, i) => {
        if (category.name) {
          textMap[`name_${i}`] = index++;
          textsToTranslate.push(this.stripHtml(category.name));
        }

        if (category.description) {
          textMap[`description_${i}`] = index++;
          textsToTranslate.push(this.stripHtml(category.description));
        }
      });

      if (!textsToTranslate.length) {
        return categories;
      }

      const translatedTexts = await this.translationService.translateBatch(
        textsToTranslate,
        lang
      );

      return categories.map((category, i) => {
        const translated: any = { ...category };

        if (textMap[`name_${i}`] !== undefined) {
          translated.name = translatedTexts[textMap[`name_${i}`]];
          translated.original_name = category.name;
        }

        if (textMap[`description_${i}`] !== undefined) {
          translated.description = translatedTexts[textMap[`description_${i}`]];
          translated.original_description = category.description;
        }

        return translated;
      });
    } catch (error) {
      this.logger.error('Translation failed, returning original categories', error);
      return categories;
    }
  }

  private async translateCategoryWithSubcategories(
    category: CategoryWithSubcategories,
    lang: string,
  ): Promise<CategoryWithSubcategories> {
    try {
      const textsToTranslate: string[] = [];
      const textMap: { [key: string]: number } = {};
      let index = 0;

      if (category.name) {
        textMap['main_name'] = index++;
        textsToTranslate.push(this.stripHtml(category.name));
      }

      if (category.description) {
        textMap['main_description'] = index++;
        textsToTranslate.push(this.stripHtml(category.description));
      }

      category.subcategories?.forEach((sub, i) => {
        if (sub.name) {
          textMap[`sub_name_${i}`] = index++;
          textsToTranslate.push(this.stripHtml(sub.name));
        }

        if (sub.description) {
          textMap[`sub_description_${i}`] = index++;
          textsToTranslate.push(this.stripHtml(sub.description));
        }
      });

      if (!textsToTranslate.length) {
        return category;
      }

      const translatedTexts = await this.translationService.translateBatch(
        textsToTranslate,
        lang
      );

      const translated: any = { ...category };

      if (textMap['main_name'] !== undefined) {
        translated.name = translatedTexts[textMap['main_name']];
        translated.original_name = category.name;
      }

      if (textMap['main_description'] !== undefined) {
        translated.description = translatedTexts[textMap['main_description']];
        translated.original_description = category.description;
      }

      if (category.subcategories?.length) {
        translated.subcategories = category.subcategories.map((sub, i) => {
          const translatedSub: any = { ...sub };

          if (textMap[`sub_name_${i}`] !== undefined) {
            translatedSub.name = translatedTexts[textMap[`sub_name_${i}`]];
            translatedSub.original_name = sub.name;
          }

          if (textMap[`sub_description_${i}`] !== undefined) {
            translatedSub.description = translatedTexts[textMap[`sub_description_${i}`]];
            translatedSub.original_description = sub.description;
          }

          return translatedSub;
        });
      }

      return translated;
    } catch (error) {
      this.logger.error('Translation failed, returning original category', error);
      return category;
    }
  }

  private async translateTags(tags: any[], lang: string) {
    try {
      const tagNames = tags.map(tag => this.stripHtml(tag.name || ''));
      
      if (!tagNames.length) {
        return tags;
      }

      const translatedNames = await this.translationService.translateBatch(
        tagNames,
        lang
      );

      return tags.map((tag, i) => ({
        ...tag,
        name: translatedNames[i],
        original_name: tag.name,
      }));
    } catch (error) {
      this.logger.error('Translation failed, returning original tags', error);
      return tags;
    }
  }

  private async translateBrands(brands: any[], lang: string) {
    try {
      const brandNames = brands.map(brand => this.stripHtml(brand.name || ''));
      
      if (!brandNames.length) {
        return brands;
      }

      const translatedNames = await this.translationService.translateBatch(
        brandNames,
        lang
      );

      return brands.map((brand, i) => ({
        ...brand,
        name: translatedNames[i],
        original_name: brand.name,
      }));
    } catch (error) {
      this.logger.error('Translation failed, returning original brands', error);
      return brands;
    }
  }

  private stripHtml(html: string): string {
    if (!html) return '';
    return html.replace(/<[^>]*>/g, '').replace(/&nbsp;/g, ' ').trim();
  }
}
