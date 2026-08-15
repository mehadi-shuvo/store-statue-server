# Gift-card commerce backend

This module extends the existing shared `Cart`, `Order`, and `OrderItem` architecture. It does not create a second payment or order stack.

## Current development fulfillment decision

Instant buy and gift-card cart checkout re-read prices, allocate inventory, create delivery rows, and invoke the console delivery provider. The order becomes `COMPLETED`, while `paymentStatus` deliberately remains `PENDING`; the server does not claim that money was paid and does not create a fake `Payment` record. Before production sales, payment initiation should reserve inventory (`AVAILABLE → RESERVED`) and the verified payment callback should finalize it (`RESERVED → SOLD`) and invoke delivery. Failed or expired payment attempts should release reservations.

## Allocation safety

Allocation occurs in the same Prisma transaction as order creation. A PostgreSQL query selects eligible rows with `FOR UPDATE SKIP LOCKED`. Only the locked IDs are conditionally updated from `AVAILABLE` to `SOLD`, and the updated count must match the requested quantity. Any shortage throws and rolls back the entire order. A unique code constraint and one-to-one inventory/delivery constraint provide additional database-level protection.

## Sensitive fields

Public catalog and stock responses never select code or PIN values. Admin inventory lists mask them. The privileged admin detail endpoint and the owning customer's completed order detail are the only HTTP responses that reveal full values. Sold records are immutable and cannot be deleted.

The project currently has no field-encryption/key-management utility. Codes and PINs therefore remain reversible plaintext at rest so they can be delivered. Before production inventory is loaded, add envelope encryption backed by a managed KMS and keep decryption inside the delivery/authorized-detail boundary. Hashing is not suitable because codes must be recovered.

The console provider is intentionally isolated behind `DigitalDeliveryProvider`; replace it with a production provider without changing purchase orchestration. Never route its sensitive payload through general request/application logging.

## Routes

| Method | Path | Auth | Purpose |
|---|---|---|---|
| GET | `/api/v1/gift-cards` | Public | Active catalog with safe denomination availability |
| GET | `/api/v1/gift-cards/:slug` | Public | Active gift-card details |
| POST | `/api/v1/gift-cards/instant-buy` | User | Development instant fulfillment |
| GET | `/api/v1/cart` | User | Current shared cart |
| POST | `/api/v1/cart/items` | User | Add a gift-card denomination |
| PATCH | `/api/v1/cart/items/:cartItemId` | User | Update quantity |
| DELETE | `/api/v1/cart/items/:cartItemId` | User | Remove an item |
| DELETE | `/api/v1/cart` | User | Clear cart |
| POST | `/api/v1/cart/checkout` | User | Validate and fulfill gift-card cart |
| GET | `/api/v1/me/gift-card-orders` | User | Paginated personal history without codes |
| GET | `/api/v1/me/gift-card-orders/:orderId` | Owner | Completed-order details and delivered codes |
| POST/GET | `/api/v1/admin/gift-cards` | Admin | Create/list products |
| GET/PATCH/DELETE | `/api/v1/admin/gift-cards/:giftCardId` | Admin | Read/update/archive product |
| POST/GET | `/api/v1/admin/gift-cards/:giftCardId/denominations` | Admin | Create/list denominations |
| PATCH/DELETE | `/api/v1/admin/gift-card-denominations/:denominationId` | Admin | Update/deactivate denomination |
| POST | `/api/v1/admin/gift-card-denominations/:denominationId/codes` | Admin | Add one inventory code |
| POST | `/api/v1/admin/gift-card-denominations/:denominationId/codes/bulk` | Admin | Atomically validate and add a batch |
| GET | `/api/v1/admin/gift-card-denominations/:denominationId/codes` | Admin | Filtered masked inventory list |
| GET/PATCH/DELETE | `/api/v1/admin/gift-card-codes/:codeId` | Admin | Privileged detail/state management |
| GET | `/api/v1/admin/gift-card-inventory/summary` | Admin | Stock totals and low-stock denominations |
| GET | `/api/v1/admin/gift-card-orders` | Admin | Filtered gift-card order list |
| GET | `/api/v1/admin/gift-card-orders/:orderId` | Admin | Gift-card order and fulfillment detail |

No Swagger/OpenAPI system exists in this repository, so route documentation lives here rather than introducing unrelated documentation infrastructure.
