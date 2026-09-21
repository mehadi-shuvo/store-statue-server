# Game top-up commerce and provider fulfillment

The game top-up checkout reuses `GameTopUpProduct`, `GameTopUpPackage`, dynamic `GameTopUpInputField` definitions, `Order`, `OrderItem`, `Payment`, and `GameTopUpOrderDetail`. Prices, payment state, and fulfillment state remain separate. No duplicate top-up order model or provider-specific database table is needed.

## End-to-end flow

1. The frontend reads the active game, its packages, and its configured account fields.
2. The authenticated customer creates an order with the selected package and dynamic account values.
3. The backend validates the package belongs to the optional `gameId`, validates every account value against the game's active field definitions, reads the price from PostgreSQL, and stores price/product snapshots with payment and fulfillment both pending.
4. The frontend initializes aamarPay using the returned `orderId` and redirects to the returned hosted `paymentUrl`.
5. A gateway callback or authenticated verify request makes the backend query aamarPay's transaction API. The callback body cannot mark an order paid.
6. Only a verified `PAID` transaction assigns the existing queue record and starts provider fulfillment.
7. A row-locked provider claim changes fulfillment from `PENDING`/`QUEUED` to `PROCESSING` and uses the immutable `GX-TOPUP-...` key plus provider-product snapshot.
8. Success becomes `DELIVERED`; pending/timeouts become `PROVIDER_PENDING`; temporary failures become `FAILED_RETRYABLE`; permanent failures become `FAILED_FINAL`. Payment remains `PAID`.
9. The database-backed worker applies bounded backoff, queries unknown submissions before resubmitting, and sends exhausted attempts to `MANUAL_REVIEW`.

Payment and provider requests never run inside the same database transaction as the remote network call. State is committed before each call, and the provider claim is row-locked. Duplicate callbacks cannot submit the same pending item twice. The provider request receives the stored fulfillment key on every retry; a real adapter must send it as its merchant/client reference.

## State model

`Order.paymentStatus` and `Payment.paymentStatus` describe money movement:

```text
PENDING -> PROCESSING -> PAID
                     -> FAILED
                     -> CANCELLED
```

`OrderItem.deliveryStatus` independently describes top-up fulfillment:

```text
PENDING/QUEUED -> PROCESSING -> DELIVERED (API fulfillmentStatus: SUCCESS)
                       |  \
                       |   -> FAILED_FINAL
                       v
        PROVIDER_PENDING / FAILED_RETRYABLE
                       |
                       +----> PROCESSING (bounded query/retry)
                       +----> MANUAL_REVIEW
```

A successful payment can have any non-initial fulfillment state. The client must not treat `paymentStatus=PAID` as proof that game currency was delivered. Failed or cancelled payment leaves fulfillment `PENDING` and never calls the game provider.

Generic `OrderItem.fulfillmentReference` stores the provider order ID. `fulfillmentData` stores only an allowlisted provider name, status, message, and optional failure code. `failureReason` and the existing detail timestamps hold safe customer-facing failure state. Raw provider payloads and account identifiers are not written to logs or audit metadata.

## Provider abstraction

`IGameTopUpProvider.topUp()` accepts:

```ts
{
  idempotencyKey: string;
  orderId: string;
  gameCode: string;
  packageCode: string;
  accountDetails: Record<string, string>;
}
```

It returns `SUCCESS`, `PENDING`, or `FAILED` with safe fields. Optional `queryTopUp()` and `getHealth()` methods support timeout reconciliation and purchase-time availability/balance checks. Business logic depends only on this interface. To integrate a reseller later:

1. Add an adapter implementing `IGameTopUpProvider`.
2. Add the provider name and validated credentials to environment configuration.
3. Map local game/package identifiers to the reseller's product codes inside the adapter or catalog configuration.
4. Update the provider factory.
5. Preserve the supplied idempotency key, sanitize logs/responses, set timeouts, and verify any asynchronous reseller webhook before changing fulfillment.

No payment or order-service rewrite is required.

## Configuration

```dotenv
PAYMENT_PROVIDER=aamarpay
GAME_TOPUP_PROVIDER=mock
MOCK_GAME_API_RESULT=success
MOCK_GAME_API_DELAY_MS=3000
MOCK_GAME_PROVIDER_BALANCE=1000000
TOP_UP_RETRY_BACKOFF_SECONDS=30,120,600,1800
TOP_UP_PROCESSING_STALE_SECONDS=300
TOP_UP_WORKER_INTERVAL_MS=30000
TOP_UP_MAX_PROVIDER_ATTEMPTS=5
TOP_UP_EMAIL_RETRY_MINUTES=5
TOP_UP_EMAIL_MAX_ATTEMPTS=5
```

`MOCK_GAME_API_RESULT` accepts `success`, `pending`, `failed`, `timeout`, `delayed_success`, `provider_down`, and `insufficient_balance`. This enables local failure testing without production controls. The delay accepts `0` through `120000` milliseconds. Environment parsing rejects unsupported values. Keep gateway/provider secrets in backend environment storage only.

## Customer routes

All customer routes require authentication and verify order ownership.

| Method | Path | Purpose |
|---|---|---|
| GET | `/api/v1/games` | List active games |
| GET | `/api/v1/games/:slug` | Read an active game |
| GET | `/api/v1/games/:gameId/packages` | Read active packages and database prices |
| GET | `/api/v1/games/:gameId/account-fields` | Read the game's dynamic form definition |
| POST | `/api/v1/game-topup/orders` | Create a pending order |
| GET | `/api/v1/game-topup/orders` | Read paginated owned history |
| GET | `/api/v1/game-topup/orders/:orderId` | Read owned payment and fulfillment status |
| POST | `/api/v1/payments/aamarpay/initiate` | Initialize hosted checkout using `{ orderId }` |
| POST | `/api/v1/payments/verify` | Independently reconcile a known payment ID |

`/api/v1/game-topup-orders` remains a compatibility alias for the order routes. `/api/v1/top-ups` remains a catalog alias.

Create request:

```json
{
  "gameId": "game-uuid",
  "packageId": "package-uuid",
  "accountDetails": {
    "playerId": "123456789",
    "zoneId": "1001"
  }
}
```

`gameId` is optional for compatibility. When present, the backend rejects unknown games and packages belonging to a different game. `accountDetails` is intentionally dynamic; the frontend must build it from `/account-fields` instead of hardcoding player/zone fields.

Create response data includes `orderId`, authoritative `totalBdt`, `paymentStatus: PENDING`, and `fulfillmentStatus: PENDING`. Initiate payment with the `orderId`; do not send an amount.

Order status response data includes:

```json
{
  "id": "order-uuid",
  "orderNumber": "GTU-...",
  "amount": "500.00",
  "currency": "BDT",
  "paymentStatus": "PAID",
  "transactionId": "gateway-transaction-id",
  "fulfillmentStatus": "SUCCESS",
  "providerName": "mock",
  "providerOrderId": "MOCK-...",
  "createdAt": "...",
  "updatedAt": "...",
  "items": []
}
```

Each item also includes the game/package IDs, masked account details, fulfillment status, safe failure message, and timestamps. Account identifiers stay masked in customer responses.

## Frontend status handling

- Before payment: show **Payment Pending**.
- After the aamarPay success redirect: fetch the owned order. Show **Payment Successful / Top-Up Processing** while payment is `PAID` and fulfillment is `PENDING` or `PROCESSING`.
- When fulfillment is `SUCCESS`: show **Top-Up Successful**.
- For `PROVIDER_PENDING`, `FAILED_RETRYABLE`, or `PROCESSING`: keep **Payment Successful**, show processing/retry state, and continue polling.
- For `FAILED_FINAL` or `MANUAL_REVIEW`: keep **Payment Successful**, show the safe support message, and stop rapid polling.
- When payment is `FAILED` or `CANCELLED`: show that payment result and do not claim fulfillment began.
- Poll every two or three seconds while fulfillment is processing, then stop on `SUCCESS`, `FAILED_FINAL`, `MANUAL_REVIEW`, or `CANCELLED`.
- Never include aamarPay credentials, provider credentials, prices, or trusted payment status in client code.

The old manual admin claim/complete/fail endpoints remain as a controlled fallback for orders that have not been claimed by the provider. Manual completion and failure require the same admin who claimed the item, so they cannot race an automatically processing provider order.

## Verification

`npm test` runs compilation and unit suites. `npm run test:payment:integration` creates a disposable PostgreSQL database and verifies the commerce suite. `TEST_SCHEMA_MODE=migrate node scripts/test-payment-integration.cjs` validates the checked-in migration chain too. Coverage includes provider success/permanent failure, timeout query-before-retry, retry exhaustion/manual review, price snapshots, and duplicate-callback idempotency.
