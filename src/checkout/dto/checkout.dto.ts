// src/checkout/dto/checkout.dto.ts
import {
  IsString,
  IsNumber,
  IsEmail,
  IsOptional,
  IsArray,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

export class ItemDto {
  @IsNumber()
  product_id: number;

  @IsOptional()
  @IsNumber()
  variation_id?: number;

  @IsNumber()
  quantity: number;

  @IsOptional()
  @IsArray()
  variation?: Array<{ attribute: string; value: string }>;
}

export class ShippingOptionDto {
  @IsOptional()
  @IsString()
  method_id?: string;

  @IsOptional()
  @IsString()
  method_title?: string;

  @IsOptional()
  @IsNumber()
  cost?: number;
}

export class AddressDto {
  @IsString()
  first_name: string;

  @IsString()
  last_name: string;

  @IsOptional()
  @IsString()
  company?: string;

  @IsString()
  address_1: string;

  @IsOptional()
  @IsString()
  address_2?: string;

  @IsString()
  city: string;

  @IsString()
  state: string;

  @IsString()
  postcode: string;

  @IsString()
  country: string;
}

export class CustomerDataDto extends AddressDto {
  @IsEmail()
  email: string;

  @IsOptional()
  @IsString()
  phone?: string;

  @IsOptional()
  @ValidateNested()
  @Type(() => AddressDto)
  shipping_address?: AddressDto;

  @IsOptional()
  @ValidateNested()
  @Type(() => ShippingOptionDto)
  shipping_option?: ShippingOptionDto;

  @IsOptional()
  @IsString()
  order_notes?: string;
}

export class PaymentDataDto {
  @IsString()
  key: string;

  @IsString()
  value: string;
}

export class CompleteCheckoutDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ItemDto)
  items: ItemDto[];

  @ValidateNested()
  @Type(() => CustomerDataDto)
  customer_data: CustomerDataDto;

  @IsString()
  payment_method: string;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => PaymentDataDto)
  payment_data?: PaymentDataDto[];
}
