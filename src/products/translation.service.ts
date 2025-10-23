/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/no-unsafe-return */
/* eslint-disable @typescript-eslint/no-unsafe-call */
/* eslint-disable @typescript-eslint/no-unsafe-argument */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
// services/translation.service.ts
import { Injectable, Logger } from '@nestjs/common';
import axios from 'axios';

@Injectable()
export class TranslationService {
  private readonly logger = new Logger(TranslationService.name);
  private translationCache = new Map<string, string>(); // Simple in-memory cache

  async translateText(text: string, targetLang: string): Promise<string> {
    if (!text || text.trim() === '' || targetLang === 'en') return text;

    const cleanText = text.replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').trim();
    if (!cleanText) return text;

    const cacheKey = `${targetLang}:${cleanText}`;
    const cached = this.translationCache.get(cacheKey);
    if (cached !== undefined) {
      return cached;
    }

    try {
      const apiKey = process.env.GOOGLE_TRANSLATE_API_KEY;
      if (!apiKey) {
        this.logger.error('❌ GOOGLE_TRANSLATE_API_KEY is not set in environment variables');
        return text;
      }

      this.logger.log(`🔄 Translating: "${cleanText.substring(0, 50)}..." to ${targetLang}`);
      this.logger.log(`🔑 Using API Key: ${apiKey.substring(0, 10)}...${apiKey.substring(apiKey.length - 4)}`);

      const requestData = {
        q: cleanText,
        target: targetLang,
        format: 'text'
      };

      this.logger.log(`📤 Request data: ${JSON.stringify(requestData)}`);

      const response = await axios.post(
        'https://translation.googleapis.com/language/translate/v2',
        requestData,
        {
          params: {
            key: apiKey
          },
          headers: {
            'Content-Type': 'application/json',
            'Accept': 'application/json'
          },
          timeout: 10000
        }
      );

      const translatedText = response.data.data.translations[0].translatedText;
      this.translationCache.set(cacheKey, translatedText);

      this.logger.log(`✅ Translation successful: "${translatedText}"`);
      return translatedText;

    } catch (error) {
      if (error.response) {
        this.logger.error(`❌ API Error Details:`);
        this.logger.error(`   Status: ${error.response.status}`);
        this.logger.error(`   Headers: ${JSON.stringify(error.response.headers)}`);
        this.logger.error(`   Data: ${JSON.stringify(error.response.data)}`);
        this.logger.error(`   Request URL: ${error.config?.url}`);
        this.logger.error(`   Request Params: ${JSON.stringify(error.config?.params)}`);
      } else if (error.request) {
        this.logger.error(`❌ Network Error: ${error.message}`);
      } else {
        this.logger.error(`❌ Translation failed: ${error.message}`);
      }
      return text;
    }
  }


  async translateProduct(product: any, targetLang: string) {
    if (!product || targetLang === 'en') return product;

    const translatedProduct = { ...product };

    // Translate name
    if (product.name) {
      translatedProduct.name = await this.translateText(product.name, targetLang);
    }

    // Translate description
    if (product.description) {
      translatedProduct.description = await this.translateText(product.description, targetLang);
    }

    // Translate short description
    if (product.short_description) {
      translatedProduct.short_description = await this.translateText(product.short_description, targetLang);
    }

    // Translate categories
    if (product.categories && product.categories.length > 0) {
      translatedProduct.categories = await Promise.all(
        product.categories.map(async (category) => ({
          ...category,
          name: await this.translateText(category.name, targetLang)
        }))
      );
    }

    return translatedProduct;
  }

  // في translation.service.ts
async translateToEnglish(text: string): Promise<string> {
  if (!text || text.trim() === '') return text;

  const cleanText = text.trim();
  const cacheKey = `to-en:${cleanText}`;
  const cached = this.translationCache.get(cacheKey);
  if (cached) return cached;

  try {
    const apiKey = process.env.GOOGLE_TRANSLATE_API_KEY;
    if (!apiKey) {
      this.logger.error('❌ GOOGLE_TRANSLATE_API_KEY is not set');
      return text;
    }


    const response = await axios.post(
      'https://translation.googleapis.com/language/translate/v2',
      {
        q: cleanText,
        target: 'en', 
        format: 'text'
      },
      {
        params: { key: apiKey },
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        },
        timeout: 5000
      }
    );

    const translatedText = response.data.data.translations[0].translatedText;
    this.translationCache.set(cacheKey, translatedText);

    return translatedText;

  } catch (error) {
    this.logger.error(`❌ Translation to English failed: ${error.message}`);
    return text;
  }
}

}
