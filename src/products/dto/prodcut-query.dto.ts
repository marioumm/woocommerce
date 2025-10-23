import { IsOptional, IsNumberString, IsString } from 'class-validator';

export class ProductQueryDto {
  @IsOptional()
  @IsNumberString()
  page?: string = '1';

  @IsOptional()
  @IsNumberString()
  per_page?: string = '10';

  @IsOptional()
  @IsString()
  search?: string;

  @IsOptional()
  @IsString()
  category?: string;

  @IsOptional()
  @IsNumberString()
  min_price?: string;

  @IsOptional()
  @IsNumberString()
  max_price?: string;
}
