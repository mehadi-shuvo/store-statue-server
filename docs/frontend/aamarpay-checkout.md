# Frontend handoff: aamarPay checkout

The backend migration changes the gateway contract. The separate client repository was inspected but is outside this backend change.

Required client updates:

- `src/services/api/gift-card.service.ts`: parse `paymentUrl`, `transactionId`, `paymentId`, `orderId`, and `paymentExpiresAt`. Redirect with `paymentUrl`. `paymentExpiresAt` is an ISO timestamp for the five-minute inventory reservation deadline; stop/disable payment UI when it passes. Completed delivery now reports `payment.provider: "AAMARPAY"`; retain support for historical provider labels when displaying old orders.
- `src/types/gift-card.ts`: use generic payment URL/transaction fields and include the new provider label.
- Update buy-now/cart checkout components that read the old gateway-specific URL field.
- Remove the old gateway's labels, query parameter assumptions, and callback/execution calls. Generic `/payments/create` remains available with `{ orderId }` only; `/payments/initiate` is preferred. No client-supplied amount is accepted.
- Existing `/payment/success`, `/payment/failed`, `/payment/cancelled`, and `/payment/processing` routes receive only `orderId`. Fetch owned order details and show a code only when the backend reports paid/completed. For a known payment ID, authenticated POST `/payments/verify` independently reconciles it. `/payments/status/:paymentId` only reads stored state.
- Keep existing account authentication and `Idempotency-Key` retry behavior. Never send/store gateway credentials in frontend settings.
- Treat `UNKNOWN` as verification pending and keep polling with backoff. Treat `REFUND_PENDING` as paid-but-under-review; do not show a fulfilled product or ask the customer to pay again.

Suggested Codex prompt for the client repository:

> Inspect this frontend's checkout services, gift-card types, buy-now/cart components, and payment result pages. The backend now uses aamarPay. Preserve existing layouts and authentication. Parse and redirect with `data.paymentUrl`; persist `data.orderId`, `data.paymentId`, and `data.transactionId` (the merchant ID). Parse `data.paymentExpiresAt` as the five-minute inventory reservation deadline, show a countdown, and stop/disable payment UI after expiry. Initialize an existing order with authenticated POST `/api/v1/payments/initiate` and `{ orderId }`, or retain `/api/v1/checkout/buy-now` for gift-card purchases. Never send an amount. Handle success/failed/cancelled/processing redirects by orderId and independently read owned backend order state before showing purchased codes. Accept AAMARPAY as the new delivery payment provider while keeping historical order labels readable. Remove obsolete gateway-specific fields, labels, and callback handling. Preserve idempotent retries, update tests, and run the existing checks. Do not add gateway credentials to the frontend.
