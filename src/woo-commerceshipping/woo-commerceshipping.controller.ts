import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Query,
  ParseIntPipe,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { WooCommerceShippingService } from './woo-commerceshipping.service';

// DTOs
class CalculateShippingDto {
  destinationCountry: string;
  destinationState?: string;
  destinationPostcode?: string;
  cartItems: Array<{
    product_id: number;
    quantity: number;
    shipping_class?: string;
  }>;
  cartTotal: number;
}

class GetAvailableRatesDto {
  country: string;
  state?: string;
  postcode?: string;
  cartTotal?: number;
  cartItems?: Array<{
    product_id: number;
    quantity: number;
    shipping_class?: string;
  }>;
}

@Controller('api/shipping')
export class WooCommerceShippingController {
  private readonly logger = new Logger(WooCommerceShippingController.name);

  constructor(private readonly shippingService: WooCommerceShippingService) {}

  @Get('methods')
  async getAllShippingMethods():Promise<any> {
    try {
      return await this.shippingService.getAllShippingMethods();
    } catch (error) {
      this.logger.error('Error fetching shipping methods:', error.message);
      throw new HttpException(
        'Failed to fetch shipping methods',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Get('methods/:methodId')
  async getShippingMethodById(@Param('methodId') methodId: string):Promise<any> {
    try {
      return await this.shippingService.getShippingMethodById(methodId);
    } catch (error) {
      this.logger.error(
        `Error fetching shipping method ${methodId}:`,
        error.message,
      );
      throw new HttpException(
        'Shipping method not found',
        HttpStatus.NOT_FOUND,
      );
    }
  }

  @Get('zones')
  async getAllShippingZones():Promise<any> {
    try {
      return await this.shippingService.getAllShippingZones();
    } catch (error) {
      this.logger.error('Error fetching shipping zones:', error.message);
      throw new HttpException(
        'Failed to fetch shipping zones',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Get('zones/:zoneId')
  async getShippingZoneById(@Param('zoneId', ParseIntPipe) zoneId: number):Promise<any> {
    try {
      return await this.shippingService.getShippingZoneById(zoneId);
    } catch (error) {
      this.logger.error(
        `Error fetching shipping zone ${zoneId}:`,
        error.message,
      );
      throw new HttpException('Shipping zone not found', HttpStatus.NOT_FOUND);
    }
  }

  @Get('zones/:zoneId/locations')
  async getShippingZoneLocations(
    @Param('zoneId', ParseIntPipe) zoneId: number,
  ):Promise<any> {
    try {
      return await this.shippingService.getShippingZoneLocations(zoneId);
    } catch (error) {
      this.logger.error(
        `Error fetching locations for zone ${zoneId}:`,
        error.message,
      );
      throw new HttpException(
        'Failed to fetch zone locations',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Get('zones/:zoneId/methods')
  async getShippingZoneMethods(@Param('zoneId', ParseIntPipe) zoneId: number):Promise<any> {
    try {
      return await this.shippingService.getShippingZoneMethods(zoneId);
    } catch (error) {
      this.logger.error(
        `Error fetching methods for zone ${zoneId}:`,
        error.message,
      );
      throw new HttpException(
        'Failed to fetch zone methods',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Get('zones/:zoneId/methods/:instanceId')
  async getShippingZoneMethod(
    @Param('zoneId', ParseIntPipe) zoneId: number,
    @Param('instanceId', ParseIntPipe) instanceId: number,
  ):Promise<any> {
    try {
      return await this.shippingService.getShippingZoneMethod(
        zoneId,
        instanceId,
      );
    } catch (error) {
      this.logger.error(
        `Error fetching method ${instanceId} for zone ${zoneId}:`,
        error.message,
      );
      throw new HttpException(
        'Shipping method not found',
        HttpStatus.NOT_FOUND,
      );
    }
  }

  @Post('calculate')
  async calculateShippingCosts(
    @Body() calculateShippingDto: CalculateShippingDto,
  ):Promise<any> {
    try {
      return await this.shippingService.calculateShippingCosts(
        calculateShippingDto,
      );
    } catch (error) {
      this.logger.error('Error calculating shipping costs:', error.message);
      throw new HttpException(
        'Failed to calculate shipping costs',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Post('rates')
  async getAvailableShippingRates(
    @Body() getAvailableRatesDto: GetAvailableRatesDto,
  ):Promise<any> {
    try {
      const {
        country,
        state,
        postcode,
        cartTotal = 0,
        cartItems = [],
      } = getAvailableRatesDto;

      return await this.shippingService.getAvailableShippingRates(
        country,
        state,
        postcode,
        cartTotal,
        cartItems,
      );
    } catch (error) {
      this.logger.error(
        'Error fetching available shipping rates:',
        error.message,
      );
      throw new HttpException(
        'Failed to fetch shipping rates',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Get('rates')
  async getAvailableShippingRatesQuery(
    @Query('country') country: string,
    @Query('state') state?: string,
    @Query('postcode') postcode?: string,
    @Query('cartTotal') cartTotal?: string,
  ):Promise<any> {
    try {
      if (!country) {
        throw new HttpException(
          'Country parameter is required',
          HttpStatus.BAD_REQUEST,
        );
      }
      const total = cartTotal ? parseFloat(cartTotal) : 0;

      return await this.shippingService.getAvailableShippingRates(
        country,
        state,
        postcode,
        total,
        [],
      );
    } catch (error) {
      this.logger.error(
        'Error fetching shipping rates via query:',
        error.message,
      );
      throw new HttpException(
        'Failed to fetch shipping rates',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Get('overview')
  async getShippingZonesOverview():Promise<any> {
    try {
      return await this.shippingService.getShippingZonesOverview();
    } catch (error) {
      this.logger.error('Error fetching shipping overview:', error.message);
      throw new HttpException(
        'Failed to fetch shipping overview',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

   @Post('zones/find')
  async findShippingZoneForLocation(
    @Body('country') country: string,
    @Body('state') state?: string,
    @Body('postcode') postcode?: string,
  ): Promise<any> {
    try {
      if (!country) {
        throw new HttpException(
          'Country parameter is required',
          HttpStatus.BAD_REQUEST,
        );
      }
      const zone = await this.shippingService.findShippingZoneForLocation(
        country,
        state,
        postcode,
      );

      if (!zone) {
        throw new HttpException(
          'No shipping zone found for the specified location',
          HttpStatus.NOT_FOUND,
        );
      }

      return zone;
    } catch (error) {
      this.logger.error('Error finding shipping zone:', error.message);
      throw new HttpException(
        'Failed to find shipping zone',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }
}
