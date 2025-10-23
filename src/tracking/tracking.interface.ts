export interface TrackingData {
  provider?: string;
  customProvider?: string;
  trackingNumber: string;
  trackingUrl?: string;
  dateShipped?: string;
}

export interface WooCommerceTrackingItem {
  tracking_provider: string;
  custom_tracking_provider?: string;
  tracking_number: string;
  date_shipped: string;
  custom_tracking_link?: string;
  timeline?: TrackingTimelineEvent[];

}

export interface OrderTrackingResponse {
  orderId: string;
  orderStatus: string;
  trackingItems: WooCommerceTrackingItem[];
  totalTracking: number;
}

export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  message: string;
  error?: string;
}

// في ملف tracking.interface.ts
export interface OrderTrackingResponse {
  orderId: string;
  orderStatus: string;
  trackingItems: WooCommerceTrackingItem[];
  totalTracking: number;
  shipping?: any;
  shippingLines?: any;
}

export interface TrackingTimelineEvent {
  date: string;         // "2025-07-04"
  time?: string;        // "22:13"
  status: string;       // "Delivered", "Out for delivery"...
  location?: string;    // "Dubai, Dubai Center"
  description?: string; // تفاصيل إضافية إذا متوفر
}

export interface TrackingItemWithTimeline {
  tracking_provider: string;
  custom_tracking_provider?: string;
  tracking_number: string;
  current_status?: string;
  date_shipped?: string;
  custom_tracking_link?: string;
  timeline?: TrackingTimelineEvent[];
}

export interface OrderTrackingResponse {
  orderId: string;
  orderStatus: string;
  trackingItems: WooCommerceTrackingItem[];
  totalTracking: number;
}

