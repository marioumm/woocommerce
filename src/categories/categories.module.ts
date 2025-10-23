import { Module } from '@nestjs/common';
import { CategoriesController } from './categories.controller';
import { CategoriesService } from './categories.service';
import { TranslationService } from './translation.service';

@Module({
  controllers: [CategoriesController],
  providers: [CategoriesService , TranslationService],
})
export class CategoriesModule {}
