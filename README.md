# Family Pizza Sushi

Website and Telegram ordering workflow for Family Pizza Sushi in Bohorodchany, Ukraine. Customers can order from the website or open the same menu as a Telegram Mini App. Staff review orders, set delivery fees, assign couriers, and update order status in Telegram. Delivery is confirmed by an administrator; payment is collected on receipt.

## Stack

- HTML, CSS, and native JavaScript modules for the storefront
- Node.js 20+ for the local server and production build
- Vercel Functions for the order API and Telegram webhook
- Neon Postgres with `@neondatabase/serverless` for order persistence
- Telegram Bot API and Mini Apps for customer and staff workflows

## Local development

```sh
npm ci
copy .env.example .env
npm run dev
```

Open <http://127.0.0.1:4173>. The storefront remains in phone-order mode until `ORDERS_ENABLED=true`. To work on the complete flow, configure the database and Telegram variables in `.env` and apply the SQL migration described in [docs/orders-and-deliveries.md](docs/orders-and-deliveries.md).

## Commands

| Command                    | Purpose                                                          |
| -------------------------- | ---------------------------------------------------------------- |
| `npm run dev`              | Build the site and start the local static server plus API routes |
| `npm run build`            | Create the production site in `dist/`                            |
| `npm start`                | Build and start the local server                                 |
| `npm test`                 | Run the existing Node.js test suite                              |
| `npm run telegram:webhook` | Register the Telegram webhook using `.env`                       |

## Architecture

```text
src/
  assets/       Photos, fonts, favicon, and font license
  data/         Restaurant menu and server-authoritative prices
  pages/        Storefront HTML
  scripts/      Menu, cart, checkout, and browser behavior
  server/       Order rules, PostgreSQL access, Telegram API, webhook flows
  styles/       Responsive storefront styles
api/
  orders.js             Website and Mini App order endpoint
  telegram/webhook.js   Telegram update endpoint
db/migrations/          PostgreSQL schema and indexes
scripts/                Build, local server, env loading, webhook setup
tests/                  Existing unit and static-site checks
```

The API recalculates item prices from the repository menu, validates order details, and uses an idempotency key to prevent duplicate submissions. The database is the source of truth if Telegram notifications are temporarily unavailable. Telegram callback actions are restricted to configured administrator IDs and the configured staff chat.

## Deployment

Vercel uses `vercel.json` to build the static output and deploy the `api/` functions. Create the Neon database, run `db/migrations/001_orders.sql`, configure Vercel environment variables, and register the Telegram webhook as described in [the ordering setup guide](docs/orders-and-deliveries.md). Keep `ORDERS_ENABLED=false` until the database, bot, admin chat, and webhook are configured; then set it to `true` and redeploy.

Never commit `.env` or share bot/database credentials in chat. `.env.example` contains names and placeholders only.
