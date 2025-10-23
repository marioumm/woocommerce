import {
  IsEmail,
  IsInt,
  IsOptional,
  IsString,
  Max,
  Min,
} from 'class-validator';

export class UpdateReviewDto {
  @IsOptional()
  @IsString()
  review?: string;

  @IsOptional()
  @IsString()
  reviewer?: string;

  @IsOptional()
  @IsEmail()
  reviewer_email?: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(5)
  rating?: number;

  @IsOptional()
  @IsString()
  status?: string;
}
