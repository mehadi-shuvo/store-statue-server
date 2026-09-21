const security = [{ bearerAuth: [] }, { cookieAuth: [] }];

const errorResponses = {
  "400": { $ref: "#/components/responses/BadRequest" },
  "401": { $ref: "#/components/responses/Unauthorized" },
  "403": { $ref: "#/components/responses/Forbidden" },
  "404": { $ref: "#/components/responses/NotFound" },
  "429": { $ref: "#/components/responses/RateLimited" },
  "500": { $ref: "#/components/responses/InternalError" },
};

const jsonBody = (schema: Record<string, unknown>, required = true) => ({
  required,
  content: { "application/json": { schema } },
});

const success = (description = "Successful response") => ({
  description,
  content: { "application/json": { schema: { $ref: "#/components/schemas/SuccessResponse" } } },
});

const idParameter = (name: string, description: string) => ({
  name,
  in: "path",
  required: true,
  description,
  schema: { type: "string", format: "uuid" },
});

const securedOperation = (
  tag: string,
  summary: string,
  options: Record<string, unknown> = {},
) => ({ tags: [tag], summary, security, responses: { "200": success(), ...errorResponses }, ...options });

const adminOperation = (summary: string, options: Record<string, unknown> = {}) =>
  securedOperation("Administration", summary, options);

export const openApiDocument = {
  openapi: "3.1.0",
  info: {
    title: "GameExpress API",
    version: "1.0.0",
    description:
      "API for GameExpress digital commerce. Prices, payment state, inventory state, and fulfillment state are always server-controlled. Use Authorize with a bearer token or authenticate through the accessToken cookie.",
    contact: { name: "GameExpress Engineering" },
    license: { name: "ISC", identifier: "ISC" },
  },
  servers: [
    { url: "/api/v1", description: "Current API" },
    { url: "/api", description: "Compatibility prefix" },
  ],
  tags: [
    { name: "Authentication", description: "Registration, sessions, verification, and account recovery" },
    { name: "Catalog", description: "Public digital product catalogs" },
    { name: "Cart", description: "Authenticated customer cart operations" },
    { name: "Gift Cards", description: "Gift-card checkout, orders, and delivery" },
    { name: "Game Top-up", description: "Game catalog and top-up orders" },
    { name: "Payments", description: "Payment initialization, verification, and status" },
    { name: "Reviews", description: "Customer product reviews" },
    { name: "Administration", description: "Admin-only management and operations" },
  ],
  paths: {
    "/user/register": {
      post: {
        tags: ["Authentication"], summary: "Register a customer account",
        requestBody: jsonBody({ $ref: "#/components/schemas/RegisterRequest" }),
        responses: { "201": success("Account created"), ...errorResponses },
      },
    },
    "/user/login": {
      post: {
        tags: ["Authentication"], summary: "Authenticate and set the access-token cookie",
        requestBody: jsonBody({ $ref: "#/components/schemas/LoginRequest" }),
        responses: { "200": success("Authenticated"), ...errorResponses },
      },
    },
    "/user/logout": { post: securedOperation("Authentication", "Clear the access-token cookie") },
    "/user/verify-email": {
      post: {
        tags: ["Authentication"], summary: "Verify an email address with an OTP",
        requestBody: jsonBody({ $ref: "#/components/schemas/VerifyEmailRequest" }),
        responses: { "200": success(), ...errorResponses },
      },
    },
    "/user/resend-verification": {
      post: {
        tags: ["Authentication"], summary: "Request another email verification OTP",
        requestBody: jsonBody({ type: "object", additionalProperties: false, required: ["email"], properties: { email: { type: "string", format: "email" } } }),
        responses: { "200": success(), ...errorResponses },
      },
    },
    "/user/forgot-password": {
      post: {
        tags: ["Authentication"], summary: "Request a password-reset OTP",
        requestBody: jsonBody({ type: "object", additionalProperties: false, required: ["email"], properties: { email: { type: "string", format: "email" } } }),
        responses: { "200": success(), ...errorResponses },
      },
    },
    "/user/reset-password": {
      post: {
        tags: ["Authentication"], summary: "Reset a password using an OTP",
        requestBody: jsonBody({ $ref: "#/components/schemas/ResetPasswordRequest" }),
        responses: { "200": success(), ...errorResponses },
      },
    },
    "/user/profile": {
      get: securedOperation("Authentication", "Get the current customer profile"),
      patch: securedOperation("Authentication", "Update the current customer profile", { requestBody: jsonBody({ $ref: "#/components/schemas/UpdateProfileRequest" }) }),
      delete: securedOperation("Authentication", "Delete the current customer profile", { requestBody: jsonBody({ type: "object", required: ["password"], properties: { password: { type: "string", format: "password" } } }) }),
    },
    "/categories": {
      get: { tags: ["Catalog"], summary: "List categories", responses: { "200": success(), ...errorResponses } },
      post: adminOperation("Create a category", { responses: { "201": success(), ...errorResponses }, requestBody: jsonBody({ type: "object", additionalProperties: true }) }),
    },
    "/products": {
      get: { tags: ["Catalog"], summary: "List products", responses: { "200": success(), ...errorResponses } },
      post: adminOperation("Create a product with optional images", { requestBody: { required: true, content: { "multipart/form-data": { schema: { $ref: "#/components/schemas/ProductMultipartRequest" } } } }, responses: { "201": success(), ...errorResponses } }),
    },
    "/products/{id}": {
      get: { tags: ["Catalog"], summary: "Get a product", parameters: [idParameter("id", "Product ID")], responses: { "200": success(), ...errorResponses } },
      patch: adminOperation("Update a product", { parameters: [idParameter("id", "Product ID")], requestBody: { content: { "multipart/form-data": { schema: { $ref: "#/components/schemas/ProductMultipartRequest" } } } } }),
      delete: adminOperation("Delete a product", { parameters: [idParameter("id", "Product ID")] }),
    },
    "/gift-cards": { get: { tags: ["Gift Cards"], summary: "List active gift cards", responses: { "200": success(), ...errorResponses } } },
    "/gift-cards/{id}": { get: { tags: ["Gift Cards"], summary: "Get a gift card", parameters: [idParameter("id", "Gift-card product ID")], responses: { "200": success(), ...errorResponses } } },
    "/checkout/buy-now": {
      post: securedOperation("Gift Cards", "Create a buy-now checkout and payment session", {
        parameters: [{ name: "Idempotency-Key", in: "header", required: false, schema: { type: "string", maxLength: 128 } }],
        requestBody: jsonBody({ $ref: "#/components/schemas/BuyNowRequest" }), responses: { "201": success("Checkout created"), ...errorResponses },
      }),
    },
    "/cart": {
      get: securedOperation("Cart", "Get the current cart"),
      delete: securedOperation("Cart", "Clear the current cart"),
    },
    "/cart/items": {
      post: securedOperation("Cart", "Add a gift-card denomination to the cart", { requestBody: jsonBody({ $ref: "#/components/schemas/CartItemRequest" }), responses: { "201": success(), ...errorResponses } }),
    },
    "/cart/items/{cartItemId}": {
      patch: securedOperation("Cart", "Update a cart item", { parameters: [idParameter("cartItemId", "Cart item ID")], requestBody: jsonBody({ type: "object", additionalProperties: false, required: ["quantity"], properties: { quantity: { type: "integer", minimum: 1, maximum: 10 } } }) }),
      delete: securedOperation("Cart", "Remove a cart item", { parameters: [idParameter("cartItemId", "Cart item ID")] }),
    },
    "/cart/checkout": {
      post: securedOperation("Gift Cards", "Checkout the current gift-card cart", {
        parameters: [{ name: "Idempotency-Key", in: "header", required: false, schema: { type: "string", maxLength: 128 } }],
        requestBody: jsonBody({ type: "object", additionalProperties: false, properties: { deliveryEmail: { type: "string", format: "email" } } }), responses: { "201": success("Checkout created"), ...errorResponses },
      }),
    },
    "/me/gift-card-orders": { get: securedOperation("Gift Cards", "List the current customer's gift-card orders") },
    "/me/gift-card-orders/{orderId}": { get: securedOperation("Gift Cards", "Get an owned gift-card order", { parameters: [idParameter("orderId", "Order ID")] }) },
    "/me/gift-card-orders/{orderId}/delivery": { get: securedOperation("Gift Cards", "Get fulfilled gift-card delivery details", { parameters: [idParameter("orderId", "Order ID")] }) },
    "/games": { get: { tags: ["Game Top-up"], summary: "List active games", responses: { "200": success(), ...errorResponses } } },
    "/games/{slug}": { get: { tags: ["Game Top-up"], summary: "Get a game by slug", parameters: [{ name: "slug", in: "path", required: true, schema: { type: "string" } }], responses: { "200": success(), ...errorResponses } } },
    "/games/{gameId}/packages": { get: { tags: ["Game Top-up"], summary: "List active top-up packages", parameters: [idParameter("gameId", "Game ID")], responses: { "200": success(), ...errorResponses } } },
    "/games/{gameId}/account-fields": { get: { tags: ["Game Top-up"], summary: "List required player account fields", parameters: [idParameter("gameId", "Game ID")], responses: { "200": success(), ...errorResponses } } },
    "/game-topup-orders": {
      post: securedOperation("Game Top-up", "Create a top-up order", { requestBody: jsonBody({ $ref: "#/components/schemas/GameTopUpOrderRequest" }), responses: { "201": success("Order created"), ...errorResponses } }),
      get: securedOperation("Game Top-up", "List the current customer's top-up orders"),
    },
    "/game-topup-orders/{orderId}": { get: securedOperation("Game Top-up", "Get an owned top-up order", { parameters: [idParameter("orderId", "Order ID")] }) },
    "/game-topup-orders/{orderId}/cancel": { post: securedOperation("Game Top-up", "Cancel an eligible top-up order", { parameters: [idParameter("orderId", "Order ID")] }) },
    "/payments/initiate": {
      post: securedOperation("Payments", "Initialize hosted payment for an owned order", { requestBody: jsonBody({ $ref: "#/components/schemas/PaymentInitiateRequest" }), responses: { "201": success("Payment initialized"), ...errorResponses } }),
    },
    "/payments/verify": {
      post: securedOperation("Payments", "Verify payment directly with the gateway", { requestBody: jsonBody({ $ref: "#/components/schemas/PaymentVerifyRequest" }) }),
    },
    "/payments/status/{paymentId}": { get: securedOperation("Payments", "Get an owned payment status", { parameters: [{ name: "paymentId", in: "path", required: true, schema: { type: "string" } }] }) },
    "/review/product/{productId}": { get: { tags: ["Reviews"], summary: "List product reviews", parameters: [idParameter("productId", "Product ID")], responses: { "200": success(), ...errorResponses } } },
    "/review": { post: securedOperation("Reviews", "Create a product review", { requestBody: jsonBody({ type: "object", additionalProperties: true }) , responses: { "201": success(), ...errorResponses } }) },
    "/review/{id}": {
      patch: securedOperation("Reviews", "Update an owned review", { parameters: [idParameter("id", "Review ID")], requestBody: jsonBody({ type: "object", additionalProperties: true }) }),
      delete: securedOperation("Reviews", "Delete an owned review", { parameters: [idParameter("id", "Review ID")] }),
    },
    "/admins/profile": {
      get: adminOperation("Get the current admin profile"),
      patch: adminOperation("Update the current admin profile", { requestBody: jsonBody({ type: "object", additionalProperties: true }) }),
    },
    "/admins/users": { get: adminOperation("List customer accounts") },
    "/admins/orders": { get: adminOperation("List orders") },
    "/admins/payments": { get: adminOperation("List payments") },
    "/admins/audit-logs": { get: adminOperation("List audit events") },
    "/admin/gift-card-inventory/summary": { get: adminOperation("Get gift-card inventory summary") },
    "/admin/gift-card-orders": { get: adminOperation("List gift-card orders") },
    "/admin/game-topup-orders": { get: adminOperation("List the game top-up operations queue") },
    "/admin/games": {
      get: adminOperation("List games including inactive records"),
      post: adminOperation("Create a game", { requestBody: jsonBody({ type: "object", additionalProperties: true }), responses: { "201": success(), ...errorResponses } }),
    },
    "/categories/bulk": { post: adminOperation("Create multiple categories", { requestBody: jsonBody({ type: "array", items: { type: "object", additionalProperties: true } }), responses: { "201": success(), ...errorResponses } }) },
    "/categories/{id}": {
      patch: adminOperation("Update a category", { parameters: [idParameter("id", "Category ID")], requestBody: jsonBody({ type: "object", additionalProperties: true }) }),
      delete: adminOperation("Delete a category", { parameters: [idParameter("id", "Category ID")] }),
    },
    "/products/multiple": { post: adminOperation("Bulk-create products", { requestBody: jsonBody({ type: "object", required: ["products"], properties: { products: { type: "array", items: { type: "object", additionalProperties: true } } } }), responses: { "201": success(), ...errorResponses } }) },
    "/subscriptions": {
      get: { tags: ["Catalog"], summary: "List subscription products", responses: { "200": success(), ...errorResponses } },
      post: adminOperation("Create a subscription product", { requestBody: jsonBody({ type: "object", additionalProperties: true }), responses: { "201": success(), ...errorResponses } }),
    },
    "/subscriptions/{id}": {
      get: { tags: ["Catalog"], summary: "Get a subscription product", parameters: [idParameter("id", "Subscription product ID")], responses: { "200": success(), ...errorResponses } },
      patch: adminOperation("Update a subscription product", { parameters: [idParameter("id", "Subscription product ID")], requestBody: jsonBody({ type: "object", additionalProperties: true }) }),
      delete: adminOperation("Delete a subscription product", { parameters: [idParameter("id", "Subscription product ID")] }),
    },
    "/gift-cards/instant-buy": {
      post: securedOperation("Gift Cards", "Create a direct gift-card order", { requestBody: jsonBody({ type: "object", additionalProperties: false, required: ["denominationId"], properties: { denominationId: { type: "string", format: "uuid" }, quantity: { type: "integer", minimum: 1, maximum: 20, default: 1 }, deliveryEmail: { type: "string", format: "email" }, useAccountEmail: { type: "boolean", default: true } } }), responses: { "201": success(), ...errorResponses } }),
    },
    "/payments/aamarpay/success": { post: { tags: ["Payments"], summary: "Receive aamarPay success callback and independently verify it", requestBody: jsonBody({ $ref: "#/components/schemas/AamarpayCallback" }, false), responses: { "303": { description: "Redirect to the configured frontend result page" }, ...errorResponses } } },
    "/payments/aamarpay/fail": { post: { tags: ["Payments"], summary: "Receive aamarPay failure callback and independently verify it", requestBody: jsonBody({ $ref: "#/components/schemas/AamarpayCallback" }, false), responses: { "303": { description: "Redirect to the configured frontend result page" }, ...errorResponses } } },
    "/payments/aamarpay/cancel": {
      post: { tags: ["Payments"], summary: "Receive aamarPay cancellation callback", requestBody: jsonBody({ $ref: "#/components/schemas/AamarpayCallback" }, false), responses: { "303": { description: "Redirect to the configured frontend result page" }, ...errorResponses } },
      get: { tags: ["Payments"], summary: "Receive a bodyless aamarPay cancellation redirect", parameters: [{ name: "transactionId", in: "query", required: true, schema: { type: "string", maxLength: 32 } }], responses: { "303": { description: "Redirect to the configured frontend result page" }, ...errorResponses } },
    },
    "/admins/profile/password": { patch: adminOperation("Change the current admin password", { requestBody: jsonBody({ type: "object", additionalProperties: true }) }) },
    "/admins/users/{userId}": { get: adminOperation("Get a customer account", { parameters: [idParameter("userId", "User ID")] }) },
    "/admins/users/{userId}/status": { patch: adminOperation("Update a customer account status", { parameters: [idParameter("userId", "User ID")], requestBody: jsonBody({ type: "object", additionalProperties: true }) }) },
    "/admins/users/{userId}/resolve-issue": { post: adminOperation("Record a customer issue as resolved", { parameters: [idParameter("userId", "User ID")], requestBody: jsonBody({ type: "object", additionalProperties: true }) }) },
    "/admins/orders/{orderId}": { get: adminOperation("Get an order", { parameters: [idParameter("orderId", "Order ID")] }) },
    "/admins/orders/{orderId}/status": { patch: adminOperation("Update an order status", { parameters: [idParameter("orderId", "Order ID")], requestBody: jsonBody({ type: "object", additionalProperties: true }) }) },
    "/admins/delivery/items": { get: adminOperation("List delivery items") },
    "/admins/delivery/items/{orderItemId}": { patch: adminOperation("Update a delivery item", { parameters: [idParameter("orderItemId", "Order item ID")], requestBody: jsonBody({ type: "object", additionalProperties: true }) }) },
    "/admins/payments/{paymentId}": { get: adminOperation("Get a payment", { parameters: [idParameter("paymentId", "Payment record ID")] }) },
    "/admins/payments/{paymentId}/verify": { patch: adminOperation("Resolve a payment issue", { parameters: [idParameter("paymentId", "Payment record ID")], requestBody: jsonBody({ type: "object", additionalProperties: true }) }) },
    "/admins/digital-products": { get: adminOperation("List digital products") },
    "/admins/digital-products/overview": { get: adminOperation("Get the digital product overview") },
    "/admins/stats/sales": { get: adminOperation("Get sales statistics") },
    "/admins/logs": { get: adminOperation("Read filtered application logs") },
    "/admins": {
      get: adminOperation("List administrators"),
      post: adminOperation("Create an administrator (super-admin only)", { requestBody: jsonBody({ type: "object", additionalProperties: true }), responses: { "201": success(), ...errorResponses } }),
    },
    "/admins/{adminId}": {
      get: adminOperation("Get an administrator", { parameters: [idParameter("adminId", "Administrator ID")] }),
      patch: adminOperation("Update an administrator (super-admin only)", { parameters: [idParameter("adminId", "Administrator ID")], requestBody: jsonBody({ type: "object", additionalProperties: true }) }),
    },
    "/admins/{adminId}/deactivate": { patch: adminOperation("Deactivate an administrator (super-admin only)", { parameters: [idParameter("adminId", "Administrator ID")], requestBody: jsonBody({ type: "object", additionalProperties: true }) }) },
    "/admins/{adminId}/restore": { patch: adminOperation("Restore an administrator (super-admin only)", { parameters: [idParameter("adminId", "Administrator ID")], requestBody: jsonBody({ type: "object", additionalProperties: true }) }) },
    "/admin/gift-card-orders/{orderId}": { get: adminOperation("Get a gift-card order", { parameters: [idParameter("orderId", "Order ID")] }) },
    "/admin/gift-cards": {
      get: adminOperation("List gift-card products including inactive records"),
      post: adminOperation("Create a gift-card product", { requestBody: jsonBody({ type: "object", additionalProperties: true }), responses: { "201": success(), ...errorResponses } }),
    },
    "/admin/gift-cards/{giftCardId}": {
      get: adminOperation("Get a gift-card product", { parameters: [idParameter("giftCardId", "Gift-card product ID")] }),
      patch: adminOperation("Update a gift-card product", { parameters: [idParameter("giftCardId", "Gift-card product ID")], requestBody: jsonBody({ type: "object", additionalProperties: true }) }),
      delete: adminOperation("Archive a gift-card product", { parameters: [idParameter("giftCardId", "Gift-card product ID")] }),
    },
    "/admin/gift-cards/{giftCardId}/denominations": {
      get: adminOperation("List gift-card denominations", { parameters: [idParameter("giftCardId", "Gift-card product ID")] }),
      post: adminOperation("Create a gift-card denomination", { parameters: [idParameter("giftCardId", "Gift-card product ID")], requestBody: jsonBody({ type: "object", additionalProperties: true }), responses: { "201": success(), ...errorResponses } }),
    },
    "/admin/gift-card-denominations/{denominationId}": {
      patch: adminOperation("Update a gift-card denomination", { parameters: [idParameter("denominationId", "Denomination ID")], requestBody: jsonBody({ type: "object", additionalProperties: true }) }),
      delete: adminOperation("Delete or deactivate a denomination", { parameters: [idParameter("denominationId", "Denomination ID")] }),
    },
    "/admin/gift-card-denominations/{denominationId}/codes": {
      get: adminOperation("List masked inventory codes", { parameters: [idParameter("denominationId", "Denomination ID")] }),
      post: adminOperation("Add an encrypted inventory code", { parameters: [idParameter("denominationId", "Denomination ID")], requestBody: jsonBody({ $ref: "#/components/schemas/GiftCardCodeRequest" }), responses: { "201": success(), ...errorResponses } }),
    },
    "/admin/gift-card-denominations/{denominationId}/codes/bulk": { post: adminOperation("Add encrypted inventory codes in bulk", { parameters: [idParameter("denominationId", "Denomination ID")], requestBody: jsonBody({ type: "object", required: ["codes"], properties: { codes: { type: "array", minItems: 1, maxItems: 500, items: { $ref: "#/components/schemas/GiftCardCodeRequest" } } } }), responses: { "201": success(), ...errorResponses } }) },
    "/admin/gift-card-codes/{codeId}": {
      get: adminOperation("Get authorized inventory-code details", { parameters: [idParameter("codeId", "Inventory code ID")] }),
      patch: adminOperation("Update an unsold inventory code", { parameters: [idParameter("codeId", "Inventory code ID")], requestBody: jsonBody({ $ref: "#/components/schemas/GiftCardCodeRequest" }) }),
      delete: adminOperation("Delete an eligible inventory code", { parameters: [idParameter("codeId", "Inventory code ID")] }),
    },
    "/admin/game-topup-orders/{orderId}": { get: adminOperation("Get a top-up operations order", { parameters: [idParameter("orderId", "Order ID")] }) },
    "/admin/game-topup-orders/{orderId}/start": { post: adminOperation("Claim a manual top-up order for processing", { parameters: [idParameter("orderId", "Order ID")] }) },
    "/admin/game-topup-orders/{orderId}/complete": { post: adminOperation("Complete a manual top-up order", { parameters: [idParameter("orderId", "Order ID")], requestBody: jsonBody({ type: "object", additionalProperties: true }) }) },
    "/admin/game-topup-orders/{orderId}/fail": { post: adminOperation("Fail a manual top-up order", { parameters: [idParameter("orderId", "Order ID")], requestBody: jsonBody({ type: "object", additionalProperties: true }) }) },
    "/admin/games/{gameId}": {
      get: adminOperation("Get a game", { parameters: [idParameter("gameId", "Game ID")] }),
      patch: adminOperation("Update a game", { parameters: [idParameter("gameId", "Game ID")], requestBody: jsonBody({ type: "object", additionalProperties: true }) }),
      delete: adminOperation("Archive a game", { parameters: [idParameter("gameId", "Game ID")] }),
    },
    "/admin/games/{gameId}/packages": {
      get: adminOperation("List top-up packages", { parameters: [idParameter("gameId", "Game ID")] }),
      post: adminOperation("Create a top-up package", { parameters: [idParameter("gameId", "Game ID")], requestBody: jsonBody({ type: "object", additionalProperties: true }), responses: { "201": success(), ...errorResponses } }),
    },
    "/admin/game-topup-packages/{packageId}": {
      get: adminOperation("Get a top-up package", { parameters: [idParameter("packageId", "Package ID")] }),
      patch: adminOperation("Update a top-up package", { parameters: [idParameter("packageId", "Package ID")], requestBody: jsonBody({ type: "object", additionalProperties: true }) }),
      delete: adminOperation("Deactivate a top-up package", { parameters: [idParameter("packageId", "Package ID")] }),
    },
    "/admin/games/{gameId}/account-fields": {
      get: adminOperation("List game account fields", { parameters: [idParameter("gameId", "Game ID")] }),
      post: adminOperation("Create a game account field", { parameters: [idParameter("gameId", "Game ID")], requestBody: jsonBody({ type: "object", additionalProperties: true }), responses: { "201": success(), ...errorResponses } }),
    },
    "/admin/game-account-fields/{fieldId}": {
      patch: adminOperation("Update a game account field", { parameters: [idParameter("fieldId", "Account field ID")], requestBody: jsonBody({ type: "object", additionalProperties: true }) }),
      delete: adminOperation("Deactivate a game account field", { parameters: [idParameter("fieldId", "Account field ID")] }),
    },
  },
  components: {
    securitySchemes: {
      bearerAuth: { type: "http", scheme: "bearer", bearerFormat: "JWT", description: "Paste the access token without the Bearer prefix." },
      cookieAuth: { type: "apiKey", in: "cookie", name: "accessToken", description: "HTTP-only cookie set by the login endpoint." },
    },
    responses: {
      BadRequest: { description: "Invalid request", content: { "application/json": { schema: { $ref: "#/components/schemas/ErrorResponse" } } } },
      Unauthorized: { description: "Authentication required or invalid", content: { "application/json": { schema: { $ref: "#/components/schemas/ErrorResponse" } } } },
      Forbidden: { description: "Insufficient permission", content: { "application/json": { schema: { $ref: "#/components/schemas/ErrorResponse" } } } },
      NotFound: { description: "Resource not found", content: { "application/json": { schema: { $ref: "#/components/schemas/ErrorResponse" } } } },
      RateLimited: { description: "Rate limit exceeded", headers: { "Retry-After": { schema: { type: "integer" } } }, content: { "application/json": { schema: { $ref: "#/components/schemas/ErrorResponse" } } } },
      InternalError: { description: "Internal server error", content: { "application/json": { schema: { $ref: "#/components/schemas/ErrorResponse" } } } },
    },
    schemas: {
      SuccessResponse: { type: "object", required: ["success", "message"], properties: { success: { const: true }, message: { type: "string" }, data: {}, meta: {} } },
      ErrorResponse: { type: "object", required: ["success", "statusCode", "message"], properties: { success: { const: false }, statusCode: { type: "integer" }, message: { type: "string" }, code: { type: "string" }, details: {} } },
      RegisterRequest: { type: "object", additionalProperties: false, required: ["name", "email", "password"], properties: { name: { type: "string", minLength: 2 }, email: { type: "string", format: "email" }, phone: { type: "string" }, password: { type: "string", format: "password", minLength: 8 } } },
      LoginRequest: { type: "object", additionalProperties: false, required: ["email", "password"], properties: { email: { type: "string", format: "email" }, password: { type: "string", format: "password" } } },
      VerifyEmailRequest: { type: "object", additionalProperties: false, required: ["email", "otp"], properties: { email: { type: "string", format: "email" }, otp: { type: "string", minLength: 6, maxLength: 6 } } },
      ResetPasswordRequest: { type: "object", additionalProperties: false, required: ["email", "otp", "newPassword"], properties: { email: { type: "string", format: "email" }, otp: { type: "string" }, newPassword: { type: "string", format: "password", minLength: 8 } } },
      UpdateProfileRequest: { type: "object", additionalProperties: false, properties: { name: { type: "string", minLength: 2 }, phone: { type: "string" } } },
      ProductMultipartRequest: { type: "object", properties: { title: { type: "string" }, price: { type: "number" }, thumbnail: { type: "string", format: "binary" }, bannerImage: { type: "string", format: "binary" }, features: { type: "string", description: "JSON-encoded feature array" } } },
      BuyNowRequest: { type: "object", additionalProperties: false, required: ["productId"], properties: { productId: { type: "string", format: "uuid", description: "Gift-card denomination ID, or a product with exactly one active denomination" }, quantity: { type: "integer", minimum: 1, maximum: 20, default: 1 } } },
      CartItemRequest: { type: "object", additionalProperties: false, required: ["denominationId"], properties: { denominationId: { type: "string", format: "uuid" }, quantity: { type: "integer", minimum: 1, maximum: 20, default: 1 } } },
      GameTopUpOrderRequest: { type: "object", additionalProperties: false, required: ["packageId", "accountDetails"], properties: { gameId: { type: "string", format: "uuid" }, packageId: { type: "string", format: "uuid" }, accountDetails: { type: "object", additionalProperties: true, description: "Keys and values must satisfy the active account-field definitions configured for the game." } } },
      PaymentInitiateRequest: { type: "object", additionalProperties: false, required: ["orderId"], properties: { orderId: { type: "string", format: "uuid" } } },
      PaymentVerifyRequest: { type: "object", additionalProperties: false, required: ["paymentId"], properties: { paymentId: { type: "string", description: "Merchant transaction identifier returned during initialization" } } },
      AamarpayCallback: { type: "object", additionalProperties: true, properties: { mer_txnid: { type: "string", maxLength: 32, description: "Merchant transaction ID; other gateway fields are ignored until server-side verification." } } },
      GiftCardCodeRequest: { type: "object", additionalProperties: false, required: ["code"], properties: { code: { type: "string", minLength: 4, maxLength: 500, writeOnly: true }, pin: { type: ["string", "null"], writeOnly: true }, serialNumber: { type: ["string", "null"] }, expiryDate: { type: ["string", "null"], format: "date-time" } } },
    },
  },
} as const;
