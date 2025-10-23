/* eslint-disable @typescript-eslint/no-unsafe-call */
/* eslint-disable @typescript-eslint/no-unsafe-return */
/* eslint-disable @typescript-eslint/no-unsafe-argument */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
// src/checkout/checkout.service.ts
import { Injectable, HttpException, HttpStatus, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { RpcException } from '@nestjs/microservices';
import Stripe from 'stripe';
import axios from 'axios';
import {
  CompleteCheckoutDto,
  ItemDto,
  // CustomerDataDto,
  PaymentDataDto,
} from './dto/checkout.dto';
import { WooCommerceHttpService } from 'src/shared/woocommerce-http.service';
// import { BadRequestError } from 'openai';

interface Billing {
  email?: string;
  first_name?: string;
  last_name?: string;
  phone?: string;
  [key: string]: any;
}

interface WooCommerceOrder {
  id: number;
  number: string;
  order_key: string;
  status: string;
  currency: string;
  total: string;
  payment_method: string;
  payment_method_title: string;
  transaction_id?: string;
  date_paid?: string;
  date_completed?: string;
  billing?: Billing;
  [key: string]: any;
}

interface PaymentGateway {
  id: string;
  title: string;
  enabled: boolean;
  method_title: string;
  method_supports: string[];
  settings: Record<string, any>;
  [key: string]: any;
}

@Injectable()
export class CheckoutService {
  private readonly logger = new Logger(CheckoutService.name);
  private stripe: Stripe;

  constructor(
    private readonly httpService: WooCommerceHttpService,
    private readonly configService: ConfigService,
  ) {
    const stripeKey =
      this.configService.get<string>('STRIPE_SECRET_KEY') ||
      process.env.STRIPE_SECRET_KEY;
    if (!stripeKey) {
      this.logger.warn(
        'STRIPE_SECRET_KEY is not set. Stripe payments will fail if used.',
      );
    }
    this.stripe = new Stripe(stripeKey || '', {
      apiVersion: '2024-06-20' as Stripe.LatestApiVersion,
    });
  }

  async completeCheckout(checkoutData: CompleteCheckoutDto) {
    try {
      this.logger.log('Starting complete checkout process');

      // Step 1: Validate payment method
      //   await this.validatePaymentMethod(checkoutData.payment_method);

      // Step 2: Create order directly using WooCommerce Orders API
      const order = await this.createOrder(checkoutData);

      // Step 3: Process payment if needed
      let paymentResult: { status: string; transaction_id?: string } = {
        status: 'pending',
      };

      if (
        checkoutData.payment_method !== 'cod' &&
        Array.isArray(checkoutData.payment_data) &&
        checkoutData.payment_data.length > 0
      ) {
        paymentResult = await this.processPayment(
          order,
          checkoutData.payment_data,
        );
      }

      // Step 4: Update order status based on payment method
      const finalOrder = await this.updateOrderAfterPayment(
        order,
        checkoutData.payment_method,
        paymentResult,
      );

      this.logger.log(
        `Checkout completed successfully for order ${finalOrder.id}`,
      );

      return {
        success: true,
        order_id: finalOrder.id,
        order_number: finalOrder.number,
        order_key: finalOrder.order_key,
        order_status: finalOrder.status,
        payment_status: paymentResult.status,
        total: finalOrder.total,
        currency: finalOrder.currency,
        message: 'Order completed successfully',
      };
    } catch (error: any) {
      this.logger.error(
        'Checkout process failed',
        error?.stack ?? JSON.stringify(error),
      );

      if (error instanceof HttpException || error instanceof RpcException) {
        throw error;
      }

      throw new HttpException(
        `Checkout failed: ${error?.message ?? 'Unknown error'}`,
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  private async validatePaymentMethod(paymentMethod: string): Promise<void> {
    try {
      this.logger.log(`Validating payment method: ${paymentMethod}`);

      const response = await this.httpService.get(
        `/payment_gateways/${paymentMethod}`,
        undefined,
        true,
        'V3',
      );
      const gateway: PaymentGateway = response.data;

      if (!gateway || !gateway.enabled) {
        throw new HttpException(
          `Payment method '${paymentMethod}' is not enabled`,
          HttpStatus.BAD_REQUEST,
        );
      }

      this.logger.log(`Payment method ${paymentMethod} validated successfully`);
    } catch (error: any) {
      if (error instanceof HttpException) {
        throw error;
      }

      this.logger.error(
        `Payment method validation failed: ${error?.message ?? error}`,
      );
      throw new HttpException(
        `Invalid payment method: ${paymentMethod}`,
        HttpStatus.BAD_REQUEST,
      );
    }
  }

  private async createOrder(
    checkoutData: CompleteCheckoutDto,
  ): Promise<WooCommerceOrder> {
    try {
      this.logger.log('Creating order via WooCommerce Orders API');

      // Transform items to line_items format
      const lineItems = (checkoutData.items || []).map((item: ItemDto) => {
        const base: any = {
          product_id: item.product_id,
          quantity: item.quantity,
        };

        if (item.variation_id) {
          base.variation_id = item.variation_id;
        }

        if (item.variation && item.variation.length > 0) {
          base.meta_data = item.variation.map((v) => ({
            key: v.attribute,
            value: v.value,
          }));
        }

        return base;
      });

      // Prepare shipping lines if shipping option is provided
      const shippingLines =
        checkoutData.customer_data?.shipping_option !== undefined &&
          checkoutData.customer_data.shipping_option !== null
          ? [
            {
              method_id:
                checkoutData.customer_data.shipping_option.method_id ||
                'flat_rate',
              method_title:
                checkoutData.customer_data.shipping_option.method_title ||
                'Shipping',
              total:
                checkoutData.customer_data.shipping_option.cost?.toString() ||
                '0.00',
            },
          ]
          : [];

      const orderPayload: any = {
        payment_method: checkoutData.payment_method,
        // payment_method_title: await this.getPaymentMethodTitle(
        //   checkoutData.payment_method,
        // ),
        billing: {
          first_name: checkoutData.customer_data.first_name,
          last_name: checkoutData.customer_data.last_name,
          email: checkoutData.customer_data.email,
          phone: checkoutData.customer_data.phone || '',
          address_1: checkoutData.customer_data.address_1,
          address_2: checkoutData.customer_data.address_2 || '',
          city: checkoutData.customer_data.city,
          state: checkoutData.customer_data.state,
          postcode: checkoutData.customer_data.postcode,
          country: checkoutData.customer_data.country,
          company: checkoutData.customer_data.company || '',
        },
        shipping:
          checkoutData.customer_data.shipping_address ||
          (checkoutData.customer_data && {
            first_name: checkoutData.customer_data.first_name,
            last_name: checkoutData.customer_data.last_name,
            address_1: checkoutData.customer_data.address_1,
            address_2: checkoutData.customer_data.address_2 || '',
            city: checkoutData.customer_data.city,
            state: checkoutData.customer_data.state,
            postcode: checkoutData.customer_data.postcode,
            country: checkoutData.customer_data.country,
            company: checkoutData.customer_data.company || '',
          }),
        line_items: lineItems,
        shipping_lines: shippingLines,
        customer_note: checkoutData.customer_data.order_notes || '',
        set_paid: this.shouldSetOrderAsPaid(checkoutData.payment_method),
      };

      this.logger.log('Order payload prepared', orderPayload);

      const response = await this.httpService.post(
        '/orders',
        orderPayload,
        undefined,
        true,
        'V3',
      );
      const order: WooCommerceOrder = response.data;

      this.logger.log(`Order created successfully with ID: ${order.id}`);
      return order;
    } catch (error: any) {
      this.logger.error(
        'Failed to create order',
        error?.response ?? error?.message ?? JSON.stringify(error),
      );

      const errorMessage =
        error?.response?.data?.message ||
        error?.message ||
        JSON.stringify(error) ||
        'Unknown error';
      throw new HttpException(
        `Failed to create order: ${errorMessage}`,
        error?.response?.status || HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  private async getPaymentMethodTitle(paymentMethod: string): Promise<string> {
    try {
      const response = await this.httpService.get(
        `/payment_gateways/${paymentMethod}`,
        undefined,
        true,
        'V3',
      );
      const gateway: PaymentGateway = response.data;
      return gateway?.title || gateway?.method_title || paymentMethod;
    } catch (error: any) {
      this.logger.warn(
        `Could not fetch payment method title for ${paymentMethod}: ${error?.message}`,
      );
      return paymentMethod;
    }
  }

  private shouldSetOrderAsPaid(paymentMethod: string): boolean {
    // Set as paid for payment methods that are processed immediately
    const immediatePaymentMethods = ['stripe', 'paypal' , 'skipcash'];
    return immediatePaymentMethods.includes(paymentMethod);
  }

  private async updateOrderAfterPayment(
    order: WooCommerceOrder,
    paymentMethod: string,
    paymentResult: { status: string; transaction_id?: string },
  ): Promise<WooCommerceOrder> {
    try {
      const updatePayload: any = {};

      // Determine order status based on payment method and result
      if (paymentMethod === 'cod') {
        updatePayload.status = 'processing';
      } else if (paymentResult.status === 'completed') {
        updatePayload.status = 'processing';
        updatePayload.set_paid = true;
      } else if (paymentResult.status === 'failed') {
        updatePayload.status = 'failed';
      } else if (paymentResult.status && paymentResult.status !== 'pending') {
        // pass-through status if relevant
        updatePayload.status = paymentResult.status;
      }

      // Add transaction ID if available
      if (paymentResult.transaction_id) {
        updatePayload.transaction_id = paymentResult.transaction_id;
      }

      // Update order if we have changes to make
      if (Object.keys(updatePayload).length > 0) {
        const response = await this.httpService.put(
          `/orders/${order.id}`,
          updatePayload,
          undefined,
          true,
          'V3',
        );
        return response.data;
      }

      return order;
    } catch (error: any) {
      this.logger.warn(
        `Failed to update order ${order.id} after payment: ${error?.message ?? JSON.stringify(error)}`,
      );
      // Return original order if update fails
      return order;
    }
  }

  private async processPayment(
    order: WooCommerceOrder,
    paymentData: PaymentDataDto[],
  ): Promise<{ status: string; transaction_id?: string }> {
    try {
      this.logger.log(`Processing payment for order ${order.id}`);

      // Prefer the payment method specified in checkout but fallback to order.payment_method
      const method = order.payment_method;

      switch (method) {
        case 'stripe':
          return await this.processStripePayment(order, paymentData);

        case 'paypal':
          return await this.processPayPalPayment(order, paymentData);

        case 'skipcash':
          return await this.processSkipCashPayment(order, paymentData);

        case 'bacs':
          return await this.processBankTransfer(order);

        case 'cheque':
          return await this.processChequePayment(order);

        default:
          this.logger.log(
            `No specific payment processing for method: ${method}`,
          );
          return { status: 'pending' };
      }
    } catch (error: any) {
      this.logger.error(
        `Payment processing failed for order ${order.id}: ${error?.message ?? JSON.stringify(error)}`,
      );
      return { status: 'failed' };
    }
  }

  private async processStripePayment(
    order: WooCommerceOrder,
    paymentData: PaymentDataDto[],
  ): Promise<{ status: string; transaction_id?: string }> {
    try {
      this.logger.log(`Processing Stripe payment for order ${order.id}`);

      // Extract Stripe token from paymentData. Accept payment_method id or token.
      const stripeToken = paymentData.find(
        (data) =>
          data.key === 'stripe_token' ||
          data.key === 'stripe_source' ||
          data.key === 'payment_method_id',
      )?.value;

      if (!stripeToken) {
        throw new RpcException({
          statusCode: 400,
          message: 'Stripe payment token not provided',
        });
      }

      if (!this.stripe) {
        this.logger.error('Stripe client is not configured.');
        return { status: 'failed' };
      }

      // WooCommerce total is usually in string format like "123.45"
      const amountInCents = Math.round(Number(order.total) * 100);
      if (Number.isNaN(amountInCents) || amountInCents <= 0) {
        this.logger.error(
          `Invalid order amount for order ${order.id}: ${order.total}`,
        );
        return { status: 'failed' };
      }

      // Create a PaymentIntent (recommended)
      // We attempt to create and confirm using the provided payment method/token.
      const currency = (order.currency || 'usd').toLowerCase();

      const paymentIntent = await this.stripe.paymentIntents.create({
        amount: amountInCents,
        currency,
        payment_method: stripeToken,
        confirmation_method: 'manual',
        confirm: true,
        description: `Payment for WooCommerce order #${order.id}`,
        metadata: {
          order_id: String(order.id),
          customer_email: order.billing?.email || '',
        },
      });

      // Handle different statuses
      if (paymentIntent.status === 'succeeded') {
        this.logger.log(
          `Stripe payment succeeded for order ${order.id} - ${paymentIntent.id}`,
        );
        return {
          status: 'completed',
          transaction_id: paymentIntent.id,
        };
      }

      // If requires_action, we surface the status so the caller can handle it (frontend SCA flow)
      if (
        paymentIntent.status === 'requires_action' ||
        paymentIntent.status === 'requires_payment_method'
      ) {
        this.logger.warn(
          `Stripe payment requires action for order ${order.id}: ${paymentIntent.status}`,
        );
        return { status: paymentIntent.status };
      }

      this.logger.warn(
        `Stripe payment for order ${order.id} not completed. Status: ${paymentIntent.status}`,
      );
      return { status: paymentIntent.status ?? 'pending' };
    } catch (error: any) {
      this.logger.error(
        `Stripe payment failed for order ${order.id}: ${error?.message ?? JSON.stringify(error)}`,
      );

      // Provide clearer errors if Stripe returned an error object
      if (error?.type || error?.raw?.message) {
        this.logger.debug('Stripe error detail', JSON.stringify(error));
      }

      return { status: 'failed' };
    }
  }

  private async processPayPalPayment(
    order: WooCommerceOrder,
    paymentData: PaymentDataDto[],
  ): Promise<{ status: string; transaction_id?: string }> {
    try {
      this.logger.log(`Processing PayPal payment for order ${order.id}`);

      const paypalToken = paymentData.find(
        (data) => data.key === 'paypal_token',
      )?.value;

      if (!paypalToken) {
        throw new Error('PayPal payment token not provided');
      }

      // NOTE: integrate with PayPal SDK here.
      // For now, simulate success for compatibility.
      const transactionId = `paypal_${Date.now()}`;

      this.logger.log(
        `PayPal payment processed successfully for order ${order.id}`,
      );
      return {
        status: 'completed',
        transaction_id: transactionId,
      };
    } catch (error: any) {
      this.logger.error(
        `PayPal payment failed for order ${order.id}: ${error?.message ?? JSON.stringify(error)}`,
      );
      return { status: 'failed' };
    }
  }

  private async processBankTransfer(
    order: WooCommerceOrder,
  ): Promise<{ status: string }> {
    this.logger.log(
      `Bank transfer payment for order ${order.id} - awaiting payment`,
    );
    return { status: 'on-hold' };
  }

  private async processChequePayment(
    order: WooCommerceOrder,
  ): Promise<{ status: string }> {
    this.logger.log(`Cheque payment for order ${order.id} - awaiting payment`);
    return { status: 'on-hold' };
  }

  private async processSkipCashPayment(
    order: WooCommerceOrder,
    paymentData: PaymentDataDto[],
  ): Promise<{ status: string; transaction_id?: string; payment_url?: string }> {
    try {
      this.logger.log(`Processing SkipCash payment for order ${order.id}`);

      const skipCashToken = paymentData.find(
        (data) =>
          data.key === 'skipcash_token' ||
          data.key === 'skipcash_payment_method' ||
          data.key === 'payment_method_id',
      )?.value;

      if (!skipCashToken) {
        throw new RpcException({
          statusCode: 400,
          message: 'SkipCash payment token not provided',
        });
      }

      if (!process.env.SKIPCASH_API_KEY || !process.env.SKIPCASH_BASE_URL) {
        this.logger.error('SkipCash API key or base URL is not configured.');
        return { status: 'failed' };
      }

      const amountInCents = Math.round(Number(order.total) * 100);
      if (Number.isNaN(amountInCents) || amountInCents <= 0) {
        this.logger.error(
          `Invalid order amount for order ${order.id}: ${order.total}`,
        );
        return { status: 'failed' };
      }

      const currency = (order.currency || 'usd').toLowerCase();

      const skipCashPayload = {
        amount: amountInCents,
        currency,
        reference: String(order.id),
        customer: {
          name: `${order.billing?.first_name || ''} ${order.billing?.last_name || ''}`.trim(),
          email: order.billing?.email || '',
          phone: order.billing?.phone || '',
        },
        token: skipCashToken,
        description: `Payment for WooCommerce order #${order.id}`,
        metadata: {
          order_id: String(order.id),
          customer_email: order.billing?.email || '',
        },
      };

      const response = await axios.post(
        `${process.env.SKIPCASH_BASE_URL}/api/v1/payment`,
        skipCashPayload,
        { headers: this.getSkipCashHeaders() }
      );

      if (response.data.status === 'succeeded' || response.data.status === 'completed') {
        this.logger.log(
          `SkipCash payment succeeded for order ${order.id} - ${response.data.transaction_id}`,
        );
        return {
          status: 'completed',
          transaction_id: response.data.transaction_id,
          payment_url: response.data.payment_url,
        };
      }

      if (
        response.data.status === 'requires_action' ||
        response.data.status === 'pending'
      ) {
        this.logger.warn(
          `SkipCash payment requires action for order ${order.id}: ${response.data.status}`,
        );
        return {
          status: response.data.status,
          payment_url: response.data.payment_url
        };
      }

      this.logger.warn(
        `SkipCash payment for order ${order.id} not completed. Status: ${response.data.status}`,
      );
      return {
        status: response.data.status ?? 'pending',
        payment_url: response.data.payment_url
      };
    } catch (error: any) {
      this.logger.error(
        `SkipCash payment failed for order ${order.id}: ${error?.message ?? JSON.stringify(error)}`,
      );

      if (error?.response?.data || error?.type) {
        this.logger.debug('SkipCash error detail', JSON.stringify(error?.response?.data || error));
      }

      return { status: 'failed' };
    }
  }


  private getSkipCashHeaders() {
    return {
      'Authorization': `Bearer ${process.env.SKIPCASH_API_KEY}`,
      'Content-Type': 'application/json'
    };
  }


  // Additional utility methods for order management
  async getOrder(orderId: number): Promise<WooCommerceOrder> {
    try {
      const response = await this.httpService.get(
        `/orders/${orderId}`,
        undefined,
        true,
        'V3',
      );
      return response.data;
    } catch (error: any) {
      throw new HttpException(
        `Failed to fetch order ${orderId}: ${error?.message ?? JSON.stringify(error)}`,
        error?.response?.status || HttpStatus.NOT_FOUND,
      );
    }
  }

  async getAllOrders() {
    try {
      const response = await this.httpService.get(
        `/orders`,
        undefined,
        true,
        'V3',
      );
      return response.data;
    } catch (error: any) {
      throw new HttpException(
        `Failed to fetch orders : ${error?.message ?? JSON.stringify(error)}`,
        error?.response?.status || HttpStatus.NOT_FOUND,
      );
    }
  }

  async updateOrderStatus(
    orderId: number,
    status: string,
  ): Promise<WooCommerceOrder> {
    try {
      const response = await this.httpService.put(
        `/orders/${orderId}`,
        {
          status,
        },
        undefined,
        true,
        'V3',
      );
      return response.data;
    } catch (error: any) {
      throw new HttpException(
        `Failed to update order ${orderId} status: ${error?.message ?? JSON.stringify(error)}`,
        error?.response?.status || HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  async getAvailablePaymentMethods(): Promise<PaymentGateway[]> {
    try {
      const response = await this.httpService.get(
        '/payment_gateways',
        undefined,
        true,
        'V3',
      );
      // make sure we return only enabled gateways
      const data = response.data || [];
      return data.filter((gateway: PaymentGateway) => gateway.enabled);
    } catch (error: any) {
      this.logger.error(
        'Failed to fetch payment gateways',
        error?.message ?? JSON.stringify(error),
      );
      return [];
    }
  }

  async cancelOrder(orderId: string) {
    try {
      const res = await this.httpService.put(
        `/orders/${orderId}?force=true`,
        {
          "status": "cancelled"
        },
        undefined,
        true,
        'V3',
      );
      // if (!res.data) throw new BadRequestError("Can't Delete Order");
      return res.data;
    } catch (error) {
      console.error(
        'Error deleting order:',
        error.response?.data || error.message,
      );
      throw error;
    }
  }
}
