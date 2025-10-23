// translation.service.ts
import { Injectable, Logger } from '@nestjs/common';
import axios from 'axios';

@Injectable()
export class TranslationService {
  private readonly logger = new Logger(TranslationService.name);
  private readonly API_KEY = process.env.GOOGLE_TRANSLATE_API_KEY;
  private readonly API_URL = 'https://translation.googleapis.com/language/translate/v2';
  private cache = new Map<string, { text: string; timestamp: number }>();
  private readonly CACHE_TTL = 5 * 60 * 1000; 


  async translate(
    text: string,
    targetLang: string,
    sourceLang: string = 'en'
  ): Promise<string> {
    if (targetLang === 'en' || !text || !text.trim()) {
      return text;
    }

    const cacheKey = `${text}_${targetLang}`;
    const cached = this.cache.get(cacheKey);
    
    if (cached && Date.now() - cached.timestamp < this.CACHE_TTL) {
      return cached.text;
    }

    try {
      const response = await axios.post(
        this.API_URL,
        {
          q: text,
          source: sourceLang,
          target: targetLang,
          format: 'text',
        },
        {
          params: { key: this.API_KEY },
          timeout: 3000,
        }
      );

      const translatedText = response.data.data.translations[0].translatedText;
      this.cache.set(cacheKey, { text: translatedText, timestamp: Date.now() });

      return translatedText;
    } catch (error: any) {
      this.logger.error(`Translation error for "${text}":`, error.message);
      return text; 
    }
  }

 
  async translateBatch(
    texts: string[],
    targetLang: string,
    sourceLang: string = 'en'
  ): Promise<string[]> {
    if (targetLang === 'en' || !texts.length) {
      return texts;
    }

    const validTexts = texts.map(t => t?.trim() || '');

    const results: string[] = new Array(validTexts.length);
    const textsToTranslate: string[] = [];
    const indices: number[] = [];

    validTexts.forEach((text, i) => {
      if (!text) {
        results[i] = '';
        return;
      }

      const cacheKey = `${text}_${targetLang}`;
      const cached = this.cache.get(cacheKey);
      
      if (cached && Date.now() - cached.timestamp < this.CACHE_TTL) {
        results[i] = cached.text;
      } else {
        textsToTranslate.push(text);
        indices.push(i);
      }
    });

    if (!textsToTranslate.length) {
      return results;
    }

    try {
      const batchSize = 100;
      const batches: string[][] = [];
      
      for (let i = 0; i < textsToTranslate.length; i += batchSize) {
        batches.push(textsToTranslate.slice(i, i + batchSize));
      }

      const allTranslations: string[] = [];
      
      for (const batch of batches) {
        const response = await axios.post(
          this.API_URL,
          {
            q: batch,
            source: sourceLang,
            target: targetLang,
            format: 'text',
          },
          {
            params: { key: this.API_KEY },
            timeout: 10000,
          }
        );

        const translations = response.data.data.translations.map(
          (t: any) => t.translatedText
        );
        allTranslations.push(...translations);
      }

      allTranslations.forEach((translation, i) => {
        const originalText = textsToTranslate[i];
        const cacheKey = `${originalText}_${targetLang}`;
        this.cache.set(cacheKey, { text: translation, timestamp: Date.now() });
        
        results[indices[i]] = translation;
      });

      return results;
    } catch (error: any) {
      this.logger.error('Batch translation error:', error.message);
      
      indices.forEach((originalIndex, i) => {
        results[originalIndex] = textsToTranslate[i];
      });
      
      return results;
    }
  }


  cleanCache() {
    const now = Date.now();
    let deletedCount = 0;
    
    for (const [key, value] of this.cache.entries()) {
      if (now - value.timestamp > this.CACHE_TTL) {
        this.cache.delete(key);
        deletedCount++;
      }
    }

    if (deletedCount > 0) {
      this.logger.log(`Cleaned ${deletedCount} expired cache entries`);
    }
  }

  clearCache() {
    const size = this.cache.size;
    this.cache.clear();
    this.logger.log(`Cleared entire cache (${size} entries)`);
  }

  getCacheSize(): number {
    return this.cache.size;
  }


  getCacheStats() {
    const now = Date.now();
    let validEntries = 0;
    let expiredEntries = 0;

    for (const [, value] of this.cache.entries()) {
      if (now - value.timestamp > this.CACHE_TTL) {
        expiredEntries++;
      } else {
        validEntries++;
      }
    }

    return {
      total: this.cache.size,
      valid: validEntries,
      expired: expiredEntries,
      ttl: this.CACHE_TTL / 1000, 
    };
  }
}

setInterval(() => {
}, 10 * 60 * 1000);
