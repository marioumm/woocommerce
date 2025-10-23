/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
import {
  Controller,
  Get,
  Param,
  HttpException,
  HttpStatus,
  Post,
  Body,
} from '@nestjs/common';
import { WooCommerceTrackingService } from './woocommerce-tracking.service';

@Controller('api/tracking')
export class TrackingController {
  constructor(
    private readonly wooCommerceTrackingService: WooCommerceTrackingService,
  ) {}

  @Get('order/:orderId')
  async getTracking(@Param('orderId') orderId: string) {
    try {
      const trackingInfo = await this.wooCommerceTrackingService.getOrderTracking(orderId);

      return {
        statusCode: HttpStatus.OK,
        message: 'Tracking information retrieved successfully',
        data: trackingInfo,
      };
    } catch (error) {
      throw new HttpException(
        'Failed to get tracking: ' + error.message,
        HttpStatus.NOT_FOUND,
      );
    }
  }

  @Get('shipments/:orderId')
  async getShipmentTrackings(@Param('orderId') orderId: string) {
    try {
      const shipments = await this.wooCommerceTrackingService.getShipmentTrackings(orderId);

      return {
        statusCode: HttpStatus.OK,
        message: 'Shipment trackings retrieved successfully',
        data: {
          orderId,
          shipments,
          count: shipments.length,
        },
      };
    } catch (error) {
      throw new HttpException(
        'Failed to get shipments: ' + error.message,
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }


  @Get('api-health')
  async checkAPIHealth() {
    try {
      const healthReport = await this.wooCommerceTrackingService.checkWooCommerceAPIHealth();

      return {
        statusCode: HttpStatus.OK,
        message: 'WooCommerce API Health Check Complete',
        data: healthReport,
      };
    } catch (error) {
      throw new HttpException(
        'Health check failed: ' + error.message,
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  
  @Post('test-endpoint')
  async testEndpoint(@Body() testData: { endpoint: string; method?: 'GET' | 'POST' }) {
    try {
      const result = await this.wooCommerceTrackingService.testSpecificEndpoint(
        testData.endpoint,
        testData.method || 'GET',
      );

      return {
        statusCode: result.success ? HttpStatus.OK : HttpStatus.BAD_REQUEST,
        message: result.message,
        data: result,
      };
    } catch (error) {
      throw new HttpException(
        'Endpoint test failed: ' + error.message,
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }


  @Get('test-17track/:trackingNumber')
  async test17Track(@Param('trackingNumber') trackingNumber: string) {
    try {
      const result = await this.wooCommerceTrackingService.test17TrackAPI(trackingNumber);
      
      return {
        statusCode: result.success ? HttpStatus.OK : HttpStatus.BAD_REQUEST,
        message: result.message,
        data: result,
      };
    } catch (error) {
      throw new HttpException(
        '17Track test failed: ' + error.message,
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }
}
