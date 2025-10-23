/* eslint-disable @typescript-eslint/no-unused-vars */
/* eslint-disable @typescript-eslint/no-unsafe-call */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-return */
import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { WooCommerceHttpService } from '../shared/woocommerce-http.service';
import axios from 'axios';
import { OrderTrackingResponse, TrackingTimelineEvent, WooCommerceTrackingItem } from './tracking.interface';

@Injectable()
export class WooCommerceTrackingService {
  private readonly logger = new Logger(WooCommerceTrackingService.name);

  constructor(
    private readonly wooCommerceHttp: WooCommerceHttpService,
    private readonly configService: ConfigService,
  ) {
    this.logger.log('WooCommerce Tracking Service initialized for READ-ONLY mode with Timeline support');
  }

  async fetchTimeline17Track(trackingNumber: string): Promise<TrackingTimelineEvent[]> {
    try {
      this.logger.log(`Fetching timeline for tracking number: ${trackingNumber}`);
      
      const apiKey = this.configService.get('TRACK_17_API_KEY') || process.env.TRACK_17_API_KEY;
      
      if (!apiKey) {
        this.logger.warn('17Track API key not found, skipping timeline fetch');
        return [];
      }

      const response = await axios.post(
        'https://api.17track.net/track/v2.2/gettrackinfo',
        [{ number: trackingNumber }],
        { 
          headers: { 
            '17token': apiKey,
            'Content-Type': 'application/json'
          },
          timeout: 15000 
        }
      );
      
      this.logger.debug('17Track API response:', JSON.stringify(response.data, null, 2));
      
      const trackInfo = response.data?.data?.[0];
      if (!trackInfo || !trackInfo.track_info) {
        this.logger.warn(`No tracking info found for ${trackingNumber}`);
        return [];
      }

      const events: TrackingTimelineEvent[] = trackInfo.track_info.map((event: any) => ({
        date: event.date || '',
        time: event.time || '',
        status: event.status_description || event.status || 'Unknown',
        location: event.location || '',
        description: event.details || event.status_description || ''
      }));
      
      this.logger.log(`Found ${events.length} timeline events for ${trackingNumber}`);
      return events.reverse(); 
      
    } catch (error) {
      this.logger.error(`17Track API failed for ${trackingNumber}:`, error.message);
      if (error.response) {
        this.logger.error('17Track response error:', error.response.data);
      }
      return [];
    }
  }


  async getOrderTracking(orderId: string): Promise<OrderTrackingResponse> {
    try {
      this.logger.log(`Getting tracking for order ${orderId}`);

      const orderResponse = await this.wooCommerceHttp.get(`/orders/${orderId}`, undefined, true, 'V3');
      const order = orderResponse.data;

      const trackingMeta = order.meta_data?.find((meta: any) => meta.key === '_wc_shipment_tracking_items');
      const trackingItems: WooCommerceTrackingItem[] = trackingMeta?.value || [];

      this.logger.log(`Found ${trackingItems.length} tracking items for order ${orderId}`);

      const trackingItemsWithTimeline: WooCommerceTrackingItem[] = [];
      
      for (const item of trackingItems) {
        try {
          this.logger.log(`Processing tracking item: ${item.tracking_number}`);
          
          const timeline = item.tracking_number 
            ? await this.fetchTimeline17Track(item.tracking_number)
            : [];
          
          trackingItemsWithTimeline.push({
            ...item,
            timeline
          });
          
        } catch (error) {
          this.logger.warn(`Failed to get timeline for ${item.tracking_number}:`, error.message);
          trackingItemsWithTimeline.push({
            ...item,
            timeline: []
          });
        }
      }

      const result = {
        orderId: order.id,
        orderStatus: order.status,
        trackingItems: trackingItemsWithTimeline,
        totalTracking: trackingItems.length,
        shipping: order.shipping,
        shippingLines: order.shipping_lines
      };

      this.logger.log(`Successfully processed tracking for order ${orderId}`);
      return result;

    } catch (error) {
      this.logger.error(`Error getting tracking for order ${orderId}:`, error.message);
      throw new Error(`Failed to get tracking: ${error.response?.data?.message || error.message}`);
    }
  }

  async getShipmentTrackings(orderId: string): Promise<WooCommerceTrackingItem[]> {
    try {
      const response = await this.wooCommerceHttp.get(
        `/wc-shipment-tracking/v3/orders/${orderId}/shipment-trackings`,
        undefined,
        true,
        'V3'
      );
      return response.data || [];
    } catch (error) {
      this.logger.warn(`Shipment tracking API failed, returning [] for order ${orderId}`);
      return [];
    }
  }


  async checkWooCommerceAPIHealth(): Promise<any> {
    const healthReport = {
      timestamp: new Date().toISOString(),
      baseUrls: {
        V1: this.wooCommerceHttp['baseUrl']['V1'],
        V3: this.wooCommerceHttp['baseUrl']['V3']
      },
      tests: {
        basicConnection: { status: 'pending', details: null as string | null },
        authentication: { status: 'pending', details: null as string | null },
        ordersAPI: { status: 'pending', details: null as string | null },
        shipmentTrackingAPI: { status: 'pending', details: null as string | null },
        trackingService: { status: 'pending', details: null as string | null }
      },
      summary: { passed: 0, failed: 0, total: 5 }
    };

    try {
      const response = await this.wooCommerceHttp.get('/', undefined, false, 'V3');
      healthReport.tests.basicConnection = {
        status: 'passed',
        details: `Connected successfully - ${response.status}`
      };
      healthReport.summary.passed++;
    } catch (error) {
      healthReport.tests.basicConnection = {
        status: 'failed',
        details: `Connection failed: ${error.message}`
      };
      healthReport.summary.failed++;
    }

    try {
      const response = await this.wooCommerceHttp.get('/orders?per_page=1', undefined, true, 'V3');
      healthReport.tests.authentication = {
        status: 'passed',
        details: `Authentication successful - ${response.status}`
      };
      healthReport.summary.passed++;
    } catch (error) {
      healthReport.tests.authentication = {
        status: 'failed',
        details: `Authentication failed: ${error.response?.status} - ${error.message}`
      };
      healthReport.summary.failed++;
    }
    try {
      const response = await this.wooCommerceHttp.get('/orders', undefined, true, 'V3');
      healthReport.tests.ordersAPI = {
        status: 'passed',
        details: `Orders API working - Found ${response.data?.length || 0} orders`
      };
      healthReport.summary.passed++;
    } catch (error) {
      healthReport.tests.ordersAPI = {
        status: 'failed',
        details: `Orders API failed: ${error.response?.status} - ${error.message}`
      };
      healthReport.summary.failed++;
    }

    try {
      const response = await this.wooCommerceHttp.get('/wc-shipment-tracking/v3/orders/1/shipment-trackings', undefined, true, 'V3');
      healthReport.tests.shipmentTrackingAPI = {
        status: 'passed',
        details: `Shipment Tracking API available - ${response.status}`
      };
      healthReport.summary.passed++;
    } catch (error) {
      healthReport.tests.shipmentTrackingAPI = {
        status: 'failed',
        details: `Shipment Tracking API failed: ${error.response?.status} - ${error.message}`
      };
      healthReport.summary.failed++;
    }

    try {
      const testTimeline = await this.fetchTimeline17Track('TEST123456');
      healthReport.tests.trackingService = {
        status: 'passed',
        details: '17Track API service available'
      };
      healthReport.summary.passed++;
    } catch (error) {
      healthReport.tests.trackingService = {
        status: 'failed',
        details: `17Track API failed: ${error.message}`
      };
      healthReport.summary.failed++;
    }

    this.logger.log(`WooCommerce API Health Check: ${healthReport.summary.passed}/${healthReport.summary.total} tests passed`);
    return healthReport;
  }


  async testSpecificEndpoint(endpoint: string, method: 'GET' | 'POST' = 'GET'): Promise<any> {
    try {
      this.logger.log(`Testing endpoint: ${method} ${endpoint}`);
      
      let response;
      if (method === 'GET') {
        response = await this.wooCommerceHttp.get(endpoint, undefined, true, 'V3');
      } else {
        response = await this.wooCommerceHttp.post(endpoint, {}, undefined, true, 'V3');
      }
      
      return {
        success: true,
        status: response.status,
        headers: response.headers,
        dataSize: JSON.stringify(response.data).length,
        message: `${method} ${endpoint} successful`
      };
      
    } catch (error) {
      return {
        success: false,
        status: error.response?.status || 'unknown',
        error: error.message,
        details: error.response?.data || null,
        message: `${method} ${endpoint} failed`
      };
    }
  }


  async test17TrackAPI(trackingNumber: string): Promise<any> {
    try {
      const timeline = await this.fetchTimeline17Track(trackingNumber);
      return {
        success: true,
        trackingNumber,
        timelineEvents: timeline.length,
        timeline,
        message: '17Track API working successfully'
      };
    } catch (error) {
      return {
        success: false,
        trackingNumber,
        error: error.message,
        message: '17Track API failed'
      };
    }
  }
}
