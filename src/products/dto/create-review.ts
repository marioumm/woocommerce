import {
  IsEmail,
  IsInt,
  IsOptional,
  IsString,
  Max,
  Min,
} from 'class-validator';

export class CreateReviewDto {
  @IsInt()
  product_id: number;

  @IsString()
  review: string;

  @IsString()
  reviewer: string;

  @IsEmail()
  reviewer_email: string;

  @IsInt()
  @Min(0)
  @Max(5)
  rating: number;

  @IsOptional()
  @IsString()
  status?: string;
}
