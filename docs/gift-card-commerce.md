# Gift-card commerce and aamarPay checkout

## Architecture

`AamarpayProvider` implements the existing `IPaymentProvider` abstraction with JSON payment initiation and transaction search. Gateway communication stays in `src/modules/payment/providers/aamarpay.provider.ts`; state transitions stay in `PaymentService`. There is no gateway token grant, refresh, or execute API. The mock provider is permitted only under `NODE_ENV=test` and requires explicit settlement by a test.

The existing authentication, database pricing, cart, gift-card encryption, reservation, fulfillment, top-up queue, and email services are retained. Checkout reserves stock using PostgreSQL `FOR UPDATE SKIP LOCKED`. `PaymentService` locks the order and saves a PROCESSING payment before contacting the gateway. The merchant ID is generated with 112 random bits as `GX_` plus 28 hex digits (31 characters). It is unique in `paymentId` and `merchantInvoiceNumber`; the eventual gateway `pg_txnid` is stored separately in the unique `transactionId` field and `providerPaymentId`.

Concurrent initialization of the same order cannot create multiple gateway sessions. A repeated request returns the stored URL, or HTTP 409 `PAYMENT_INITIATION_PENDING` if the first request has not produced a URL. Reuse the same `Idempotency-Key` for retries of buy-now/cart checkout. Terminal orders cannot reopen a payment. A definitive initiation rejection releases inventory; an ambiguous timeout retains the persisted transaction and stock for later verification.

Each gateway session also has a `PaymentAttempt` row with a unique merchant transaction ID, optional unique gateway transaction ID, expected amount/currency, timestamps, sanitized metadata, and failure/reconciliation state. The existing `Payment` row remains the order-level payment aggregate for API compatibility.

Payment transitions are explicit: `CREATED/PENDING/INITIATED -> PROCESSING -> PAID`, with definite terminal `FAILED/CANCELLED`, ambiguous `UNKNOWN`, and `REFUND_PENDING -> REFUNDED/REFUND_FAILED`. An expired reservation whose gateway still says pending becomes `UNKNOWN`; expiry alone never releases stock.

## Environment

The existing local ports are backend 5000 and frontend 3000. `.env` contains the local sandbox credentials and remains ignored by Git. `.env.example` is the canonical safe-to-commit template and intentionally contains no signature key.

```dotenv
PAYMENT_PROVIDER=aamarpay
AAMARPAY_MODE=sandbox
AAMARPAY_STORE_ID=aamarpaytest
AAMARPAY_SIGNATURE_KEY=
AAMARPAY_BASE_URL=https://sandbox.aamarpay.com
AAMARPAY_PAYMENT_URL=https://sandbox.aamarpay.com/jsonpost.php
AAMARPAY_TRANSACTION_URL=https://sandbox.aamarpay.com/api/v1/trxcheck/request.php
AAMARPAY_REQUEST_TIMEOUT_MS=30000
BACKEND_PUBLIC_URL=http://localhost:5000
FRONTEND_URL=http://localhost:3000
```

Keep `GIFT_CARD_ENCRYPTION_KEY` unchanged: stored encrypted cards depend on it. Retain existing SMTP, database, JWT, Redis, and inventory reservation/email retry variables. `CLIENT_URL` remains supported for existing CORS settings; `FRONTEND_URL` controls payment result redirects and is also allowed by CORS.

Payment configuration is validated with Zod. Invalid providers/modes, missing credentials, malformed URLs, incorrect gateway hosts, and invalid timeouts fail at startup without printing secrets. Production mode requires HTTPS URLs, a production store, and the official production host. Customer name/email/phone/address come from the authenticated user's profile and order/default address. Missing optional sandbox details have safe defaults; profiles are not modified. Production checkout requires a phone number.

## API

All paths also remain mounted under the existing `/api` compatibility prefix.

| Method | Path | Authentication | Purpose |
| --- | --- | --- | --- |
| POST | `/api/v1/checkout/buy-now` | Customer JWT | Price and reserve a gift-card denomination, then initialize payment |
| POST | `/api/v1/gift-cards/instant-buy` | Customer JWT | Existing gift-card selection workflow |
| POST | `/api/v1/cart/checkout` | Customer JWT | Reserve the gift-card cart and initialize payment |
| POST | `/api/v1/payments/initiate` | Customer JWT | Initialize payment for an owned pending order |
| POST | `/api/v1/payments/aamarpay/initiate` | Customer JWT | Alias for generic initialization |
| POST | `/api/v1/payments/create` | Customer JWT | Existing generic compatibility alias |
| POST | `/api/v1/payments/verify` | Customer JWT | Independently verify an owned payment |
| POST | `/api/v1/payments/execute` | Customer JWT | Compatibility alias for verification; never executes a charge |
| GET | `/api/v1/payments/status/:paymentId` | Customer JWT | Read an owned payment/order status |
| POST | `/api/v1/payments/aamarpay/success` | Gateway callback, no JWT | Verify transaction; callback outcome alone is ignored |
| POST | `/api/v1/payments/aamarpay/fail` | Gateway callback, no JWT | Independently determine actual status |
| POST, GET | `/api/v1/payments/aamarpay/cancel` | Gateway callback, no JWT | Supports form callback and bodyless redirect |
| GET | `/api/v1/orders/:orderId/delivery` | Customer JWT | Reveal purchased gift cards only after completed, paid fulfillment |
| GET | `/api/v1/me/gift-card-orders/:orderId` | Customer JWT | Existing owned order details |

Initialization accepts only `{ "orderId": "..." }`; a frontend `amount` or `transactionId` is rejected. Buy-now accepts `{ "productId": "<denomination-id>", "quantity": 1 }`. A product ID can also be used when it has exactly one active denomination. Gift-card checkout requires a verified account email.

```json
{
  "success": true,
  "message": "Payment initialized successfully",
  "data": {
    "paymentUrl": "https://sandbox.aamarpay.com/paynow.php?track=...",
    "transactionId": "GX_<28-random-hex-digits>",
    "paymentId": "GX_<28-random-hex-digits>",
    "orderId": "<order-uuid>"
  }
}
```

Buy-now retains additional existing non-secret order metadata. The frontend redirects using `paymentUrl`. Verification takes `{ "paymentId": "<merchant-transaction-id>" }`. No initiation/list/status response includes inventory codes or PINs. Completed delivery reports `payment.provider: "AAMARPAY"` for new payments and preserves historical provider labels for old orders.

## Verification and callbacks

Success/fail callbacks accept JSON or `application/x-www-form-urlencoded`. Gateway form navigation can reach these exact callback routes without frontend CORS or customer JWT requirements. Other endpoints retain authentication/CORS. The server places its lookup transaction ID in each callback URL; callback `mer_txnid` must match it if both are present. Extra fields, including supplied amounts/statuses/credentials, are discarded. GET success is not a route. POST replies redirect using 303 to prevent form resubmission.

For every unsettled payment, the provider performs a separate GET to the Transaction Search API using the stored merchant transaction ID, configured store ID, and signature key. It checks the returned merchant/store identity, exact `mer_txnid`, recognized `status_code`, and a consistent successful `pay_status`. The service then checks exact decimal amount, any returned settlement/merchant currencies, the payment/order association, order amount, and a nonempty unique gateway transaction ID.

Only verified status 2 / Successful can settle. Under order/payment row locks, the service rechecks current payment and order state. In one transaction it marks payment PAID, marks the order paid/completed, moves reserved inventory to SOLD, and creates delivery records through the existing fulfillment service. Already-paid callbacks do not allocate stock again. Email uses the existing claim/retry workflow so repeated callbacks do not resend a completed delivery.

A verified late payment after a prior definitive failure/cancellation enters `PAYMENT_RECEIVED_AFTER_EXPIRY`. The service transactionally allocates equivalent unsold inventory and fulfills when possible. If inventory is unavailable, money remains recorded and the payment/order become `REFUND_PENDING`; no code belonging to another order is delivered. The refund service does not pretend that a gateway refund happened—an admin or future gateway refund adapter must resolve it to `REFUNDED` or `REFUND_FAILED`.

Authoritative status 7 fails payment; status 3 cancels/expires it and releases the reservation. Merely visiting a fail or cancel URL while gateway status is still 0/Pending does **not** release inventory. Ambiguous timeout/unknown/mismatching responses retain stock and show processing. The background sweep verifies expired reservations; it does not release a card while the gateway still reports pending. This avoids selling a code again while an earlier payment can still complete. A long-pending/unknown sandbox transaction may need investigation instead of forced automatic release.

Redirects use existing frontend result routes:

- `${FRONTEND_URL}/payment/success?orderId=...`
- `${FRONTEND_URL}/payment/failed?orderId=...`
- `${FRONTEND_URL}/payment/cancelled?orderId=...`
- `${FRONTEND_URL}/payment/processing?orderId=...` while verification is pending or unavailable.

No credentials, gift-card codes, or PINs appear in redirects. Gateway errors retain only safe operation/status metadata; search URLs, response PII, signature keys, and raw fetch errors are not logged or persisted.

## Manual sandbox test

1. Run `npx prisma migrate deploy`, then `npm run server:dev`. Keep the configured encryption key and a valid SMTP configuration for actual email delivery.
2. Use an account with verified email, and an active gift-card product/denomination with AVAILABLE inventory.
3. Run the frontend on port 3000 and make the client contract changes listed in [the frontend handoff](frontend/aamarpay-checkout.md).
4. For a browser on the same machine, the existing localhost return URLs can be used. If the gateway or a remote test device must reach the API, set `BACKEND_PUBLIC_URL` to a public HTTPS tunnel origin and restart; no code edits are required.
5. Send authenticated POST `/api/v1/checkout/buy-now` with the selected denomination ID and a fresh `Idempotency-Key`. Open `data.paymentUrl` in the browser.
6. Complete the test using the options shown by aamarPay sandbox. The backend independently searches the transaction, completes the order only after verification, and redirects to the result page.
7. Read the owned order/delivery and confirm exactly one sold code and one delivery. Replay the same callback and confirm no extra stock change or email.
8. Start another checkout and fail/cancel it. A confirmed gateway failure/expiry releases inventory. Pending gateway state remains processing until a later confirmed outcome.

## Migration and testing

Migration `20260914000000_add_aamarpay_payment_method` adds `AAMARPAY`. The two `2026091500...` hardening migrations add enum values first, then add `PaymentAttempt`, reconciliation fields, top-up provider snapshots/idempotency/retry fields, and indexes. Existing payments are backfilled into one sanitized attempt. Historical methods, applied migrations, and payment records are preserved.

`npm run typecheck`, `npm test`, and `npm run build` are the project checks. `npm run test:payment:integration` creates a temporary PostgreSQL database from the current schema, runs all gift-card/top-up/payment tests with mocked gateway/email, and drops the test database. Its role needs database creation privileges. Tests cover auth/ownership, duplicate initialization, request/response contracts, timeout/rejection, callback verification, amount/ID/currency mismatch, repeated concurrent fulfillment, terminal states, and form/JSON callbacks.

Official protocol references: [JSON initiation](https://aamarpay.readme.io/reference/initiate-payment-json), [Transaction Search](https://aamarpay.readme.io/reference/search-transaction), [sandbox credentials](https://aamarpay.readme.io/reference/sandbox-credentials-1).
