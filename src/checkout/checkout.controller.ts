/* eslint-disable @typescript-eslint/no-unsafe-return */
// src/checkout/checkout.controller.ts
import {
  Controller,
  Post,
  Body,
  HttpCode,
  HttpStatus,
  Get,
  Delete,
  Param,
} from '@nestjs/common';
import { CheckoutService } from './checkout.service';
import { CompleteCheckoutDto } from './dto/checkout.dto';

@Controller('api/checkout')
export class CheckoutController {
  constructor(private readonly checkoutService: CheckoutService) {}
  @Post('complete')
  @HttpCode(HttpStatus.OK)
  async completeCheckout(@Body() checkoutData: CompleteCheckoutDto) {
    return await this.checkoutService.completeCheckout(checkoutData);
  }

  @Get('')
  async getAllOrders() {
    return await this.checkoutService.getAllOrders();
  }

  @Delete(':id')
  async deleteOrder(@Param('id') id: string) {
    return await this.checkoutService.cancelOrder(id);
  }
}
