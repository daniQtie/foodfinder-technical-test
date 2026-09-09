# FoodFinder

FoodFinder is a small full-stack technical-test application for finding packaged foods by product name or general search term. A Next.js interface calls a separate Express API, which retrieves and normalizes Open Food Facts data, records searches for one seeded demo user in MySQL, and enforces premium nutrition access from Stripe-synchronized subscription state.

## Features

- Keyword product search through the Express backend and Open Food Facts
- Predictable product DTOs with safe handling for missing names, brands, images, quantities, and nutriments
- Product images use small official OFF assets with two concurrent downloads, request spacing, and bounded retries for temporary network failures or image-host rate limits. Blob URLs are released when cards change or unmount; missing files still display a translated placeholder.
- English, Dutch, German, and French interface dictionaries with a persistent manual selector
- Localized Open Food Facts product names with an explicit fallback chain
- One deterministic `demo@example.com` user; no out-of-scope authentication system
- MySQL-backed recent search history, newest first
- Stripe-hosted Checkout in subscription mode using a configured recurring Price
- Signature-verified Stripe webhooks with replay protection and subscription lifecycle synchronization
- Server-side nutrition authorization: free responses omit the `nutrition` property entirely
- Automated API, normalization, localization, persistence, authorization, and webhook tests

## Architecture

```text
Next.js (apps/web)
        |
        v
Express REST API (apps/api)
   |          |             |
   v          v             v
Open Food   Prisma ------> MySQL
 Facts       ^
             |
           Stripe <------ Stripe webhooks
```

Product searches always go through Express. The browser downloads public product images from Open Food Facts' official static host, but never calls Stripe's secret API or decides whether nutrition is authorized.

## Prerequisites

- Node.js 20.9 or newer (Node.js 24 is used in this repository's verification environment)
- npm
- MySQL 8.x or a compatible supported MySQL/MariaDB service
- A Stripe account in test mode
- [Stripe CLI](https://docs.stripe.com/stripe-cli) for local webhook forwarding

## Installation

```bash
git clone https://github.com/daniQtie/foodfinder-technical-test.git
cd foodfinder-technical-test
npm install
cp .env.example .env
```

On PowerShell, use `Copy-Item .env.example .env` instead of `cp` if preferred. Edit `.env` with local database and Stripe test values. Both workspaces load the root environment file.

## Database setup

Create the database and a dedicated application user in MySQL, then set `DATABASE_URL` in `.env`. Apply the committed migration and seed the demo user:

```bash
npm run prisma:migrate
npm run prisma:seed
```

For an existing database where the committed migration should be applied without creating a development migration, use:

```bash
npm exec --workspace @foodfinder/api -- prisma migrate deploy
npm run prisma:seed
```

The schema is in `apps/api/prisma/schema.prisma`; the initial SQL migration is committed under `apps/api/prisma/migrations/`.

## Running development

```bash
npm run dev
```

- Web: `http://localhost:3000`
- API: `http://localhost:4000`
- Health check: `http://localhost:4000/api/health`

The root development command runs both workspaces. The API allows CORS only from the configured `APP_URL`.

## Stripe setup

1. Open Stripe in test mode.
2. Create a Premium product.
3. Add a recurring monthly Price.
4. Set its `price_...` identifier as `STRIPE_PRICE_ID` in `.env`.
5. Set the test secret key (`sk_test_...`) as `STRIPE_SECRET_KEY`.
6. Forward test webhooks to the Express raw-body endpoint:

   ```bash
   stripe listen --forward-to localhost:4000/api/stripe/webhook
   ```

7. Copy the CLI's `whsec_...` signing secret into `STRIPE_WEBHOOK_SECRET`.

The checkout route creates or reuses the demo user's Stripe Customer and creates a hosted Checkout Session with `mode: "subscription"`. The success page polls the backend a bounded number of times because a redirect is not proof of payment. Webhooks remain authoritative.

Relevant local webhook events are:

- `checkout.session.completed`
- `customer.subscription.created`
- `customer.subscription.updated`
- `customer.subscription.deleted`

## Environment variables

See `.env.example` for the complete list:

- `DATABASE_URL` — MySQL connection string
- `PORT` — Express port
- `APP_URL` — allowed frontend origin and Stripe redirect base
- `OPEN_FOOD_FACTS_BASE_URL` and `OPEN_FOOD_FACTS_USER_AGENT`
- `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, and `STRIPE_PRICE_ID`
- `NEXT_PUBLIC_API_URL` — browser-visible Express base URL

Never commit `.env`; it is ignored by Git.

## Testing and verification

```bash
npm test
npm run typecheck
npm run lint
npm run build
npm run prisma:validate
npm run prisma:generate
```

Tests use Supertest and Vitest with in-memory service doubles. They make no live Stripe or Open Food Facts calls and do not require a test database.

## API contract

```http
GET  /api/health
GET  /api/products/search?q=nutella&lang=en
GET  /api/searches/recent
GET  /api/subscription/status
POST /api/subscription/checkout
POST /api/stripe/webhook
```

Errors use a stable shape:

```json
{
  "error": {
    "code": "INVALID_QUERY",
    "message": "Search query is required."
  }
}
```

## Internationalization approach

Interface strings live in `apps/web/messages/{en,nl,de,fr}.json` and are selected from one typed dictionary. The language selector is manual, defaults to English, persists only the language preference in `localStorage`, and updates the document language without a reload. Search history and subscription state remain server-owned.

For product names, the backend checks fields in this order:

1. `product_name_{selectedLanguage}`
2. `product_name`
3. `product_name_en`
4. `generic_name_{selectedLanguage}`
5. `generic_name`
6. A localized “Unknown product” label

FoodFinder does not machine-translate community product data. Switching the interface language repeats the current search so localized Open Food Facts fields can be selected again.

## Technical decisions

### Open Food Facts search

The challenge requires keyword/title search. Open Food Facts documents that ordinary full-text search is not available in the current v2/v3 search APIs; the legacy `/cgi/search.pl` endpoint is the documented mechanism that supports keyword search. This dependency is isolated in `apps/api/src/services/openFoodFacts.service.ts`, with a timeout, a small page size, a restricted field list, a configured User-Agent, and safe upstream error mapping.

The legacy search endpoint is rate-limited and can occasionally return a transient server error. The service canonicalizes keyword casing/spacing and sends `no_count=1` because the UI only needs the first 12 products, not a total count of all matches. Open Food Facts' [search implementation](https://github.com/openfoodfacts/openfoodfacts-server/blob/main/lib/ProductOpener/Display.pm) supports skipping the expensive count; this also skips writing its shared result cache, so FoodFinder maintains its own bounded cache.

Successful results stay fresh for 30 minutes in a 50-entry memory cache keyed by query and language. Nonempty results up to one hour old are returned immediately while a single refresh runs in the background. Failed refreshes wait at least one minute before another attempt. Results older than an hour are never used; empty results expire after 30 minutes. The cache stores upstream product data, never an authorized HTTP response. Each request rereads the subscription from MySQL immediately before constructing the free or premium DTO, including after a slow upstream request.

Cold searches still depend on Open Food Facts availability and can take up to two eight-second attempts plus a short retry delay. Rate-limit responses are not retried; new upstream requests pause for at least one minute and respect a longer `Retry-After` header, while valid cached searches continue to work. The interface distinguishes timeouts from rate limits and other failures. The memory cache resets when the API process restarts; run only one `npm run dev` session to avoid competing watchers and repeated cache resets.

The frontend depends only on FoodFinder's normalized DTO, so this service can later move to Search-a-licious or another supported full-text provider without changing the browser contract.

### DTO normalization

Open Food Facts data is community maintained and inconsistent. Pure helpers convert missing values to `null`, reject invalid numbers and `NaN`, select localized names, and construct explicit free or premium response shapes. Raw upstream objects never cross the API boundary.

### Subscription authorization

The only premium allow-listed Stripe status is `active`. States such as `trialing`, `past_due`, `paused`, `canceled`, `unpaid`, `incomplete`, and `incomplete_expired` do not unlock nutrition. This conservative policy is centralized in `premiumAccess.ts` and covered by tests.

Stripe webhooks update the local subscription record. Every product search independently reads that server-side state. Free responses are constructed without a `nutrition` property; React does not receive hidden protected values.

### Webhook reliability

The webhook route is mounted with `express.raw()` before JSON middleware, rejects invalid signatures, safely ignores unrelated events, uses subscription upserts, and records processed event IDs in `StripeEvent`. Replayed events return successfully without reprocessing. For subscription lifecycle events, the backend retrieves the latest subscription from Stripe instead of trusting delivery order, verifies that it belongs to the seeded demo user and configured premium Price, and then persists the current status. Checkout customer creation uses a stable idempotency key, and an already-active user cannot accidentally create another subscription.

### Scope

One seeded demo user matches the assignment directly. Authentication, multiple tiers, queues, persistent/distributed caching, and administrative features are intentionally omitted.

## Important implementation areas

- Open Food Facts: `apps/api/src/services/openFoodFacts.service.ts`
- Normalization and localization: `apps/api/src/utils/normalizeProduct.ts`, `apps/api/src/utils/localization.ts`
- Premium rule: `apps/api/src/utils/premiumAccess.ts`
- Product API enforcement: `apps/api/src/services/product.service.ts`
- Checkout: `apps/api/src/services/stripe.service.ts`, `apps/api/src/services/subscription.service.ts`
- Raw-body webhook: `apps/api/src/app.ts`, `apps/api/src/controllers/stripeWebhook.controller.ts`
- Prisma: `apps/api/prisma/schema.prisma`, `apps/api/prisma/migrations/`, `apps/api/prisma/seed.ts`
- UI dictionaries: `apps/web/messages/`
- Frontend search: `apps/web/components/FoodFinderApp.tsx`
- Tests: `apps/api/tests/`

## Known limitations

- Open Food Facts is community maintained; product fields and nutrient values may be incomplete or inaccurate.
- Product localization depends on translations present in Open Food Facts.
- Keyword search relies on the isolated legacy Open Food Facts full-text mechanism while their search APIs evolve.
- Open Food Facts limits legacy search traffic. The bounded memory cache improves repeated local searches, but a genuinely unavailable or rate-limited upstream can still require the user to wait and retry.
- The application intentionally supports only one seeded demo user and has no authentication system.
- Stripe is configured for test mode; credentials and test webhook forwarding are required for end-to-end payment verification.
- Nutrition availability varies by product record.
- This implementation does not include a Stripe customer portal; subscription lifecycle changes can be exercised from the Stripe test dashboard or CLI.
