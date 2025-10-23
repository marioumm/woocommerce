import { Injectable, Logger } from '@nestjs/common';
import { WooCommerceHttpService } from 'src/shared/woocommerce-http.service';

// Interface definitions
interface ShippingMethod {
  id: string;
  title: string;
  description: string;
  _links?: any;
}

interface ShippingZone {
  id: number;
  name: string;
  order: number;
  _links?: any;
}

interface ShippingZoneLocation {
  code: string;
  type: 'postcode' | 'state' | 'country' | 'continent';
  _links?: any;
}

interface ShippingZoneMethod {
  instance_id: number;
  title: string;
  order: number;
  enabled: boolean;
  method_id: string;
  method_title: string;
  method_description: string;
  settings: {
    [key: string]: {
      id: string;
      label: string;
      description: string;
      type: string;
      value: string;
      default: string;
      tip: string;
      placeholder: string;
      options?: { [key: string]: string };
    };
  };
  _links?: any;
}

interface ShippingCalculationParams {
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

interface ShippingRate {
  instance_id: number;
  method_id: string;
  title: string;
  cost: number;
  enabled: boolean;
  description?: string;
}

@Injectable()
export class WooCommerceShippingService {
  private readonly logger = new Logger(WooCommerceShippingService.name);

  constructor(
    private readonly wooCommerceHttpService: WooCommerceHttpService,
  ) {}

  /**
   * Get all available shipping methods
   */
  async getAllShippingMethods(): Promise<ShippingMethod[]> {
    try {
      const response = await this.wooCommerceHttpService.get(
        '/shipping_methods',
        undefined,
        true,
        'V3',
      );
      return response.data;
    } catch (error) {
      this.logger.error('Failed to fetch shipping methods:', error.message);
      throw error;
    }
  }

  /**
   * Get a specific shipping method by ID
   */
  async getShippingMethodById(methodId: string): Promise<ShippingMethod> {
    try {
      const response = await this.wooCommerceHttpService.get(
        `/shipping_methods/${methodId}`,
        undefined,
        true,
        'V3',
      );
      return response.data;
    } catch (error) {
      this.logger.error(
        `Failed to fetch shipping method ${methodId}:`,
        error.message,
      );
      throw error;
    }
  }

  /**
   * Get all shipping zones
   */
  async getAllShippingZones(): Promise<ShippingZone[]> {
    try {
      const response = await this.wooCommerceHttpService.get(
        '/shipping/zones',
        undefined,
        true,
        'V3',
      );
      return response.data;
    } catch (error) {
      this.logger.error('Failed to fetch shipping zones:', error.message);
      throw error;
    }
  }

  /**
   * Get a specific shipping zone by ID
   */
  async getShippingZoneById(zoneId: number): Promise<ShippingZone> {
    try {
      const response = await this.wooCommerceHttpService.get(
        `/shipping/zones/${zoneId}`,
        undefined,
        true,
        'V3',
      );
      return response.data;
    } catch (error) {
      this.logger.error(
        `Failed to fetch shipping zone ${zoneId}:`,
        error.message,
      );
      throw error;
    }
  }

  /**
   * Get all locations for a shipping zone
   */
  async getShippingZoneLocations(
    zoneId: number,
  ): Promise<ShippingZoneLocation[]> {
    try {
      const response = await this.wooCommerceHttpService.get(
        `/shipping/zones/${zoneId}/locations`,
        undefined,
        true,
        'V3',
      );
      return response.data;
    } catch (error) {
      this.logger.error(
        `Failed to fetch locations for zone ${zoneId}:`,
        error.message,
      );
      throw error;
    }
  }

  /**
   * Get all shipping methods for a specific zone
   */
  async getShippingZoneMethods(zoneId: number): Promise<ShippingZoneMethod[]> {
    try {
      const response = await this.wooCommerceHttpService.get(
        `/shipping/zones/${zoneId}/methods`,
        undefined,
        true,
        'V3',
      );
      return response.data;
    } catch (error) {
      this.logger.error(
        `Failed to fetch methods for zone ${zoneId}:`,
        error.message,
      );
      throw error;
    }
  }

  /**
   * Get a specific shipping method from a zone
   */
  async getShippingZoneMethod(
    zoneId: number,
    instanceId: number,
  ): Promise<ShippingZoneMethod> {
    try {
      const response = await this.wooCommerceHttpService.get(
        `/shipping/zones/${zoneId}/methods/${instanceId}`,
        undefined,
        true,
        'V3',
      );
      return response.data;
    } catch (error) {
      this.logger.error(
        `Failed to fetch method ${instanceId} for zone ${zoneId}:`,
        error.message,
      );
      throw error;
    }
  }

  /**
   * Find the appropriate shipping zone for a given location
   */
  async findShippingZoneForLocation(
    country: string,
    state?: string,
    postcode?: string,
  ): Promise<ShippingZone | null> {
    try {
      const zones = await this.getAllShippingZones();

      // Check each zone's locations to find a match
      for (const zone of zones) {
        if (zone.id === 1) continue; // Skip default zone for matching loop

        const locations = await this.getShippingZoneLocations(zone.id);

        const matchingLocation = locations.find((location) => {
          switch (location.type) {
            case 'country':
              return location.code === country;
            case 'state':
              return location.code === `${country}:${state}`;
            case 'postcode':
              return location.code === postcode;
            case 'continent':
              // You might need additional logic here based on country-to-continent mapping
              return false;
            default:
              return false;
          }
        });

        if (matchingLocation) {
          return zone;
        }
      }

      // Return zone with id = 1 if no specific zone found
      return zones.find((zone) => zone.id === 1) || null;
    } catch (error) {
      this.logger.error(
        'Failed to find shipping zone for location:',
        error.message,
      );
      throw error;
    }
  }

  /**
   * Calculate shipping costs for given parameters
   */
  async calculateShippingCosts(
    params: ShippingCalculationParams,
  ): Promise<ShippingRate[]> {
    try {
      // Find the appropriate shipping zone
      const zone = await this.findShippingZoneForLocation(
        params.destinationCountry,
        params.destinationState,
        params.destinationPostcode,
      );

      if (!zone) {
        this.logger.warn('No shipping zone found for the given location');
        return [];
      }

      // Get all shipping methods for the zone
      const zoneMethods = await this.getShippingZoneMethods(zone.id);
      console.log(zoneMethods);

      // Filter only enabled methods and calculate costs
      const shippingRates: ShippingRate[] = [];

      for (const method of zoneMethods.filter((m) => m.enabled)) {
        const cost = await this.calculateMethodCost(method, params);

        shippingRates.push({
          instance_id: method.instance_id,
          method_id: method.method_id,
          title: method.title,
          cost: cost,
          enabled: method.enabled,
          description: method.method_description,
        });
      }

      // Sort by cost (ascending)
      return shippingRates.sort((a, b) => a.cost - b.cost);
    } catch (error) {
      this.logger.error('Failed to calculate shipping costs:', error.message);
      throw error;
    }
  }

  /**
   * Calculate cost for a specific shipping method
   */
  private async calculateMethodCost(
    method: ShippingZoneMethod,
    params: ShippingCalculationParams,
  ): Promise<number> {
    try {
      const settings = method.settings;

      // Handle different method types
      switch (method.method_id) {
        case 'flat_rate':
          return this.calculateFlatRateCost(settings, params);
        case 'free_shipping':
          return this.calculateFreeShippingCost(settings, params);
        case 'local_pickup':
          return 0; // Local pickup is typically free
        default:
          // For custom methods, try to parse the cost setting
          const costSetting = settings.cost;
          if (costSetting && costSetting.value) {
            return this.parseAndCalculateCost(costSetting.value, params);
          }
          return 0;
      }
    } catch (error) {
      this.logger.error(
        `Failed to calculate cost for method ${method.method_id}:`,
        error.message,
      );
      return 0;
    }
  }

  /**
   * Calculate flat rate shipping cost
   */
  private calculateFlatRateCost(
    settings: ShippingZoneMethod['settings'],
    params: ShippingCalculationParams,
  ): number {
    const baseCost = parseFloat(settings.cost?.value || '0');
    let totalCost = baseCost;
    console.log('totalCost 1', totalCost);

    // Add shipping class costs if applicable
    const calculationType = settings.type?.value || 'class';

    // if (calculationType === 'class') {
    //   // Calculate per shipping class
    //   const classCosts = new Map<string, number>();

    //   // Extract class costs from settings
    //   Object.keys(settings).forEach((key) => {
    //     if (key.startsWith('class_cost_')) {
    //       const classId = key.replace('class_cost_', '');
    //       const cost = parseFloat(settings[key].value || '0');
    //       classCosts.set(classId, cost);
    //     }
    //   });

    //   // Add costs for each item based on shipping class
    //   params.cartItems.forEach((item) => {
    //     const shippingClass = item.shipping_class || 'no_class';
    //     const classCost =
    //       classCosts.get(shippingClass) ||
    //       parseFloat(settings.no_class_cost?.value || '0');
    //     totalCost += classCost * item.quantity;
    //   });
    //   console.log('totalCost 2', totalCost);
    // } else {
    //   // Per order calculation - find the highest class cost
    //   let highestClassCost = 0;
    //   Object.keys(settings).forEach((key) => {
    //     if (key.startsWith('class_cost_')) {
    //       const cost = parseFloat(settings[key].value || '0');
    //       highestClassCost = Math.max(highestClassCost, cost);
    //     }
    //   });
    //   totalCost += highestClassCost;
    // }
    console.log('totalCost 3', totalCost);

    return Math.max(0, totalCost);
  }

  /**
   * Calculate free shipping cost
   */
  private calculateFreeShippingCost(
    settings: ShippingZoneMethod['settings'],
    params: ShippingCalculationParams,
  ): number {
    const requires = settings.requires?.value || '';
    const minAmount = parseFloat(settings.min_amount?.value || '0');

    switch (requires) {
      case 'min_amount':
        return params.cartTotal >= minAmount ? 0 : Infinity; // Infinity means not available
      case 'coupon':
        // You would need to check if a valid free shipping coupon is applied
        // This would require additional cart/coupon information
        return Infinity; // Default to not available without coupon logic
      case 'either':
        // Available with min amount OR coupon
        return params.cartTotal >= minAmount ? 0 : Infinity;
      case 'both':
        // Available with min amount AND coupon
        return params.cartTotal >= minAmount ? 0 : Infinity; // Still need coupon logic
      default:
        return 0; // No requirements
    }
  }

  /**
   * Parse and calculate cost from WooCommerce cost expressions
   * Supports [qty], [cost], and [fee] placeholders
   */
  private parseAndCalculateCost(
    costExpression: string,
    params: ShippingCalculationParams,
  ): number {
    try {
      let expression = costExpression;

      // Calculate total quantity
      const totalQty = params.cartItems.reduce(
        (sum, item) => sum + item.quantity,
        0,
      );

      // Replace placeholders
      expression = expression.replace(/\[qty\]/g, totalQty.toString());
      expression = expression.replace(/\[cost\]/g, params.cartTotal.toString());

      // Handle fee calculations [fee percent="10" min_fee="20" max_fee="50"]
      const feeRegex =
        /\[fee\s+percent="([^"]+)"(?:\s+min_fee="([^"]*)")?(?:\s+max_fee="([^"]*)")?\]/g;
      expression = expression.replace(
        feeRegex,
        (match, percent, minFee, maxFee) => {
          let fee = (params.cartTotal * parseFloat(percent)) / 100;

          if (minFee && fee < parseFloat(minFee)) {
            fee = parseFloat(minFee);
          }

          if (maxFee && fee > parseFloat(maxFee)) {
            fee = parseFloat(maxFee);
          }

          return fee.toString();
        },
      );

      // Evaluate the mathematical expression
      // Note: In production, you might want to use a safer expression evaluator
      const result = eval(expression);
      return Math.max(0, parseFloat(result) || 0);
    } catch (error) {
      this.logger.warn(
        `Failed to parse cost expression: ${costExpression}`,
        error.message,
      );
      return 0;
    }
  }

  /**
   * Get all available shipping rates for a location (simplified method)
   */
  async getAvailableShippingRates(
    country: string,
    state?: string,
    postcode?: string,
    cartTotal = 0,
    cartItems: ShippingCalculationParams['cartItems'] = [],
  ): Promise<ShippingRate[]> {
    const params: ShippingCalculationParams = {
      destinationCountry: country,
      destinationState: state,
      destinationPostcode: postcode,
      cartItems,
      cartTotal,
    };

    return this.calculateShippingCosts(params);
  }

  /**
   * Get shipping zones with their methods and locations (comprehensive overview)
   */
  async getShippingZonesOverview(): Promise<
    Array<{
      zone: ShippingZone;
      locations: ShippingZoneLocation[];
      methods: ShippingZoneMethod[];
    }>
  > {
    try {
      const zones = await this.getAllShippingZones();
      const overview: Array<{
        zone: ShippingZone;
        locations: ShippingZoneLocation[];
        methods: ShippingZoneMethod[];
      }> = [];

      for (const zone of zones) {
        const [locations, methods] = await Promise.all([
          this.getShippingZoneLocations(zone.id),
          this.getShippingZoneMethods(zone.id),
        ]);

        overview.push({
          zone,
          locations,
          methods,
        });
      }

      return overview;
    } catch (error) {
      this.logger.error(
        'Failed to get shipping zones overview:',
        error.message,
      );
      throw error;
    }
  }
}
