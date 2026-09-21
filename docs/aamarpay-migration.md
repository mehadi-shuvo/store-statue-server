# aamarPay backend migration report

## Files added or updated by this migration

Configuration and startup:

- `.env` (local only; credentials are not committed)
- `.env.example` (canonical, safe-to-commit environment template)
- `src/config/payment.config.ts` (new payment environment validation)
- `src/config/security.config.ts`
- `src/utils/env-config.ts`
- `src/utils/logger.ts`
- `src/server.ts`
- `src/middlewares/security.middleware.ts`
- `package.json`

Payment implementation:

- `src/modules/payment/providers/aamarpay.provider.ts` (new)
- `src/modules/payment/providers/mock-payment.provider.ts` (new, test-only)
- `src/modules/payment/providers/payment-provider.factory.ts`
- `src/modules/payment/interfaces/payment-provider.interface.ts`
- `src/modules/payment/types/payment.types.ts`
- `src/modules/payment/services/payment.service.ts`
- `src/modules/payment/controllers/payment.controller.ts`
- `src/modules/payment/routes/payment.route.ts`
- `src/modules/payment/validators/payment.validation.ts`
- `src/modules/payment/utils/payment.utils.ts`
- `src/modules/payment/utils/payment-verification.ts`
- `src/modules/gift-card/gift-card-purchase.service.ts`

Database, tests, and documentation:

- `prisma/models/enam.prisma`
- `prisma/schema.prisma`
- `prisma/migrations/20260914000000_add_aamarpay_payment_method/migration.sql` (new)
- `src/modules/payment/tests/aamarpay-provider.test.ts` (new)
- `src/modules/payment/tests/aamarpay-workflow.integration.test.ts` (new)
- `src/modules/payment/tests/payment-verification.test.ts`
- `src/modules/payment/tests/gateway-gift-card-workflow.integration.test.ts` (renamed and updated)
- `src/modules/gift-card/tests/gift-card.workflow.integration.test.ts`
- `scripts/test-payment-integration.cjs` (new isolated database runner)
- `README.md`
- `docs/gift-card-commerce.md`
- `docs/frontend/aamarpay-checkout.md` (new client handoff)
- `docs/aamarpay-migration.md` (this report)

Matching compiled `dist/` files and generated Prisma artifacts were rebuilt. Existing unrelated workspace changes were preserved.

## Files removed

- `src/modules/payment/providers/bkash.provider.ts`
- `src/modules/payment/providers/mock-bkash.provider.ts`
- Their compiled `dist/modules/payment/providers/*.js` counterparts
- The old `src/modules/payment/tests/bkash-gift-card-workflow.integration.test.ts` path was renamed to the generic gateway workflow test; its stale compiled file was removed.

Removed runtime functionality includes the old token grant/refresh cache, create/execute/query protocol, old callback route and payload types, old URL response field, environment accessors, logs, and old payment documentation. No dependency was specific to the removed gateway, so no package needed removal. The historical `BKASH` enum value and already-applied SQL migrations remain for database compatibility; historical records were not rewritten.

## Architecture and endpoints

`IPaymentProvider` now exposes create and query operations. `AamarpayProvider` handles HTTPS JSON initiation and Transaction Search. `PaymentService` owns durable transaction IDs, idempotency, row locks, verification, and transitions; existing gift-card fulfillment and email services are reused.

Primary new endpoints:

- Authenticated POST `/api/v1/payments/initiate` (alias `/aamarpay/initiate`)
- Authenticated POST `/api/v1/payments/verify`
- Unauthenticated gateway POST `/api/v1/payments/aamarpay/success`
- Unauthenticated gateway POST `/api/v1/payments/aamarpay/fail`
- Unauthenticated gateway POST or GET `/api/v1/payments/aamarpay/cancel`

The existing buy-now, cart checkout, generic create/execute, status, and owned delivery endpoints remain. The old execute alias now only queries/validates payment. The initiation response uses `paymentUrl`, `transactionId`, `paymentId`, and `orderId`.

## Exact environment changes

The real local `.env` now has:

| Variable | Local value |
| --- | --- |
| `PAYMENT_PROVIDER` | `aamarpay` |
| `AAMARPAY_MODE` | `sandbox` |
| `AAMARPAY_STORE_ID` | `aamarpaytest` |
| `AAMARPAY_SIGNATURE_KEY` | Supplied public sandbox key, stored only in local `.env`; omitted here |
| `AAMARPAY_BASE_URL` | `https://sandbox.aamarpay.com` |
| `AAMARPAY_PAYMENT_URL` | `https://sandbox.aamarpay.com/jsonpost.php` |
| `AAMARPAY_TRANSACTION_URL` | `https://sandbox.aamarpay.com/api/v1/trxcheck/request.php` |
| `AAMARPAY_REQUEST_TIMEOUT_MS` | `30000` |
| `BACKEND_PUBLIC_URL` | `http://localhost:5000` |
| `FRONTEND_URL` | `http://localhost:3000` |

Removed all old gateway environment declarations/accessors: `BKASH_BASE_URL`, `BKASH_MODE`, `BKASH_APP_KEY`, `BKASH_APP_SECRET`, `BKASH_USERNAME`, `BKASH_PASSWORD`, `BKASH_CALLBACK_URL`, `BKASH_PAYMENT_MODE`, and `BKASH_REQUEST_TIMEOUT_MS`. Some were only declared in code/example configuration rather than populated locally. The existing gift-card encryption key and unrelated local settings were preserved.

## Prisma migration

Applied `20260914000000_add_aamarpay_payment_method` to the configured development database. It adds `AAMARPAY` to PaymentMethod and changes the default provider for future payment rows. Existing status enums and historical data are unchanged.

## Verification

Every unsettled callback searches the stored merchant transaction ID independently. It requires the correct merchant/store and transaction, successful authoritative status, an exact decimal amount match, matching currencies when returned, and a unique gateway transaction ID. Order/payment locks recheck current state before payment PAID, order completion, inventory SOLD, and delivery creation commit together. Terminal failed/cancelled/refunded orders cannot be revived. Pending or unknown gateway state never releases inventory based on an untrusted callback.

## Validation performed

- `npm run typecheck`: passed.
- `npm test`: passed.
- `npm run build`: passed.
- Isolated PostgreSQL commerce/payment suite: 66 individual cases passed; temporary database removed.
- Real sandbox initiation with synthetic data: returned a hosted URL on `sandbox.aamarpay.com`; stored a 31-character merchant ID and PROCESSING payment before returning.
- Real sandbox Transaction Search: matching transaction returned PENDING, BDT 10.00.
- No real or sandbox payment was completed by the agent; full browser checkout remains a manual test.
- Running development server: unauthenticated initiation returns 401; GET success is not a route (404); a callback without transaction identification returns 400.
- No lint script exists in this project.

## Manual test and remaining work

Follow the [sandbox walkthrough](gift-card-commerce.md#manual-sandbox-test): start the backend/client, use a verified account and available gift-card inventory, initialize buy-now, open `paymentUrl`, complete the hosted sandbox checkout, and read the owned order/delivery. Replay the callback to confirm fulfillment is unchanged.

The separate frontend still needs the generic payment URL/transaction fields and new provider label; the [frontend handoff](frontend/aamarpay-checkout.md) includes exact file areas and a Codex prompt. Existing result page routes are reused.

SMTP credentials are not currently populated, so email delivery needs the existing SMTP settings configured. Purchased codes remain accessible through the authenticated completed-order delivery API. Local return URLs are configured for the same machine; use a public HTTPS `BACKEND_PUBLIC_URL` for gateway/remote-device access when required.
