# Frontend handoff: game top-up checkout

Build the account form from `GET /api/v1/games/:gameId/account-fields`. Submit the resulting key/value object with the selected game and package:

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

Call authenticated `POST /api/v1/game-topup/orders`, then authenticated `POST /api/v1/payments/aamarpay/initiate` with `{ "orderId": "..." }`. Redirect the browser to `data.paymentUrl`. Never send an amount; display the server's `totalBdt`.

The aamarPay result routes receive `orderId`. Fetch authenticated `GET /api/v1/game-topup/orders/:orderId` before showing a final state. Treat payment and fulfillment separately:

| Payment | Fulfillment | UI |
|---|---|---|
| `PENDING` / `PROCESSING` | `PENDING` | Payment pending |
| `PAID` | `PENDING` / `PROCESSING` | Payment successful; top-up processing |
| `PAID` | `SUCCESS` | Top-up successful |
| `PAID` | `FAILED` | Payment successful; top-up failed; show safe reason/support |
| `FAILED` / `CANCELLED` | `PENDING` | Payment failed/cancelled |

Poll every two or three seconds only while the state is nonterminal. Stop on fulfillment `SUCCESS`, `FAILED`, or `CANCELLED`, or terminal payment failure. Preserve `orderId` across the hosted checkout redirect. Do not expose gateway/provider credentials or trust callback query parameters.

## Codex frontend implementation prompt

> Inspect the existing frontend repository before editing. Implement the game top-up flow against the current backend while preserving the app's design, authentication, route conventions, API client, and state management. Load games, packages, and `/api/v1/games/:gameId/account-fields`; render every active account field dynamically and validate from its returned metadata. Create the order with authenticated POST `/api/v1/game-topup/orders` using `{ gameId, packageId, accountDetails }`. Use only the backend-returned amount. Initialize aamarPay with authenticated POST `/api/v1/payments/aamarpay/initiate` and `{ orderId }`, persist the returned order/payment IDs, then redirect to `data.paymentUrl`. On payment result pages, read `orderId`, fetch authenticated GET `/api/v1/game-topup/orders/:orderId`, and render payment and fulfillment independently. While payment is `PAID` and fulfillment is `PENDING` or `PROCESSING`, show “Payment Successful” and “Top-Up Processing” and poll every 2–3 seconds. Stop on fulfillment `SUCCESS`, `FAILED`, or `CANCELLED`; show “Top-Up Successful” on success and the backend's safe failure message plus support action on fulfillment failure. Show terminal payment failure/cancellation without claiming fulfillment started. Remove any hardcoded account fields, client-authoritative amounts, direct gateway callback handling, and old gateway-specific code. Never add payment or provider credentials to frontend code. Update relevant types and tests, then run the existing lint, typecheck, test, and build commands.
