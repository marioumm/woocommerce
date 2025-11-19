# WooCommerce API Endpoints Used

## Base URLs

- **Store API (V1)**
  - `WOOCOMMERCE_BASE_URL_V1`
  - Example: `https://pro-get.camion-app.com/wp-json/wc/store/v1`
- **REST API (V3)**
  - `WOOCOMMERCE_BASE_URL_V3`
  - Example: `https://pro-get.camion-app.com/wp-json/wc/v3`
- **Shipment Tracking plugin namespace** (under the same site)
  - `/wc-shipment-tracking/v3/...` (used via the V3 base URL)

All paths below are **relative** to one of these base URLs.

---

## 1. Products

- **Single product (Store API)**
  - Method: GET
  - Base: Store API (V1)
  - Path: `/products/{productId}`
  - Purpose: Fetch product details for product pages.

- **Product variations**
  - Method: GET
  - Base: REST API (V3)
  - Path: `/products/{productId}/variations`
  - Purpose: Fetch variations (size/color, price, stock) for a simple/variable product.

- **Product list (Store API)**
  - Method: GET
  - Base: Store API (V1)
  - Path: `/products?{query}&per_page={perPage}&page={page}`
  - Purpose: Product catalog listing with filters, pagination, and search.

- **Products by category**
  - Method: GET
  - Base: Store API (V1)
  - Path: `/products?category={categoryId}`
  - Purpose: Fetch all products belonging to a specific category.

---

## 2. Product Attributes

- **Single attribute**
  - Method: GET
  - Base: REST API (V3)
  - Path: `/products/attributes/{attributeId}`
  - Purpose: Fetch a specific product attribute definition.

- **All attributes**
  - Method: GET
  - Base: REST API (V3)
  - Path: `/products/attributes`
  - Purpose: Fetch list of product attributes.

---

## 3. Product Reviews

- **List reviews (optionally filtered by product)**
  - Method: GET
  - Base: REST API (V3)
  - Path: `/products/reviews`
  - Path with product filter: `/products/reviews?product={productId}`
  - Purpose: List product reviews.

- **Get single review**
  - Method: GET
  - Base: REST API (V3)
  - Path: `/products/reviews/{reviewId}`
  - Purpose: Fetch a single review.

- **Create review**
  - Method: POST
  - Base: REST API (V3)
  - Path: `/products/reviews`
  - Purpose: Create a new product review.

- **Batch operations**
  - Method: POST
  - Base: REST API (V3)
  - Path: `/products/reviews/batch`
  - Purpose: Batch create/update/delete reviews.

- **Update review**
  - Method: PUT
  - Base: REST API (V3)
  - Path: `/products/reviews/{reviewId}`
  - Purpose: Update a product review.

- **Delete review**
  - Method: DELETE
  - Base: REST API (V3)
  - Paths:
    - Soft delete: `/products/reviews/{reviewId}`
    - Force delete: `/products/reviews/{reviewId}?force=true`
  - Purpose: Remove a review.

---

## 4. Categories, Tags, Brands

- **All categories**
  - Method: GET
  - Base: REST API (V3)
  - Path: `/products/categories`
  - Purpose: Fetch all product categories (used for navigation + translation).

- **Single category**
  - Method: GET
  - Base: REST API (V3)
  - Path: `/products/categories/{categoryId}`
  - Purpose: Fetch details for a single category, combined with all categories to build subcategory trees.

- **Product tags**
  - Method: GET
  - Base: REST API (V3)
  - Path: `/products/tags`
  - Purpose: Fetch product tags (translated for UI).

- **Product brands**  
  _(Assumes a brands taxonomy/plugin exposing this endpoint)_
  - Method: GET
  - Base: REST API (V3)
  - Path: `/products/brands`
  - Purpose: Fetch product brands (translated for UI).

---

## 5. Orders & Checkout

- **Create order**
  - Method: POST
  - Base: REST API (V3)
  - Path: `/orders`
  - Purpose: Create WooCommerce orders during checkout.

- **Get single order**
  - Methods: GET
  - Base: REST API (V3)
  - Paths:
    - `/orders/{orderId}` (general use and tracking)
  - Purpose: Retrieve order details.

- **List orders**
  - Method: GET
  - Base: REST API (V3)
  - Paths:
    - `/orders` (general listing)
    - `/orders?per_page=1` (health-check)
  - Purpose: Check API health and list orders.

- **Check if customer purchased a product**
  - Method: GET
  - Base: REST API (V3)
  - Path: `/orders?customer={customerEmail}&status=completed`
  - Purpose: Determine if a customer has purchased a specific product before.

- **Update order (status/payment info)**
  - Method: PUT
  - Base: REST API (V3)
  - Paths:
    - `/orders/{orderId}`
    - `/orders/{orderId}?force=true` (used when cancelling with `status: cancelled`)
  - Purpose: Update order status after payment or cancel orders.

---

## 6. Payment Gateways

- **List all payment gateways**
  - Method: GET
  - Base: REST API (V3)
  - Path: `/payment_gateways`
  - Purpose: Fetch all WooCommerce payment gateways to show available methods.

- **Get single payment gateway**
  - Method: GET
  - Base: REST API (V3)
  - Path: `/payment_gateways/{paymentMethodId}`
  - Purpose: Validate and display a specific payment method (e.g., Stripe, COD, etc.).

---

## 7. Shipping (Core WooCommerce)

- **List shipping methods**
  - Method: GET
  - Base: REST API (V3)
  - Path: `/shipping_methods`
  - Purpose: List all available shipping method types.

- **Get single shipping method**
  - Method: GET
  - Base: REST API (V3)
  - Path: `/shipping_methods/{methodId}`
  - Purpose: Fetch details of a shipping method.

- **List shipping zones**
  - Method: GET
  - Base: REST API (V3)
  - Path: `/shipping/zones`
  - Purpose: Get all shipping zones.

- **Get single shipping zone**
  - Method: GET
  - Base: REST API (V3)
  - Path: `/shipping/zones/{zoneId}`
  - Purpose: Get a specific zone.

- **Shipping zone locations**
  - Method: GET
  - Base: REST API (V3)
  - Path: `/shipping/zones/{zoneId}/locations`
  - Purpose: Get locations (countries/states/postcodes) for a zone.

- **Shipping zone methods**
  - Method: GET
  - Base: REST API (V3)
  - Path: `/shipping/zones/{zoneId}/methods`
  - Purpose: List shipping methods configured for a zone.

- **Single zone method instance**
  - Method: GET
  - Base: REST API (V3)
  - Path: `/shipping/zones/{zoneId}/methods/{instanceId}`
  - Purpose: Get configuration for one shipping method instance in a zone.

---

## 8. Shipment Tracking (Plugin)

- **Order shipment tracking items**
  - Method: GET
  - Base: REST API (V3) + Shipment Tracking namespace
  - Path: `/wc-shipment-tracking/v3/orders/{orderId}/shipment-trackings`
  - Purpose: Fetch shipment tracking items for an order.

- **Shipment tracking health-check**
  - Method: GET
  - Base: REST API (V3) + Shipment Tracking namespace
  - Path: `/wc-shipment-tracking/v3/orders/1/shipment-trackings`
  - Purpose: Simple health-check against the shipment tracking plugin.

---

## 9. Store Cart (Store API)

- **Initialize cart session**
  - Method: GET
  - Base: Store API (V1)
  - Path: `/cart`
  - Purpose: Initialize a cart session and retrieve a `Cart-Token` header (used internally to support cart operations if needed).

---

## 10. Diagnostics / Health Checks

- **API root health-check**
  - Method: GET
  - Base: REST API (V3)
  - Path: `/`
  - Purpose: Basic connectivity check to the WooCommerce REST API.

- **Orders API health-check**
  - Method: GET
  - Base: REST API (V3)
  - Paths:
    - `/orders?per_page=1`
    - `/orders`
  - Purpose: Validate authentication and orders endpoint availability.

- **Generic test endpoint (internal tool)**
  - Methods: GET or POST
  - Base: REST API (V3)
  - Path: arbitrary `endpoint` (e.g. `/orders`, `/products?...`)
  - Purpose: Internal diagnostics helper to test specific WooCommerce endpoints.
