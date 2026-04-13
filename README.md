# Vikche

Vikche is a product price tracker built as a Next.js web app. It accepts product URLs, stores tracked items in PostgreSQL through Prisma, uses HTTP fetching with Zyte fallback plus OpenAI-assisted generic extraction, keeps price history, and logs or emails price-drop notifications.

## What is implemented
- Douglas connector with URL validation and canonicalization
- HTTP scraping with Zyte HTML fallback
- Prisma/PostgreSQL persistence with multi-store-ready core tables:
  - `Retailer`
  - `StoreProduct`
  - `ProductWatch`
  - `PriceSnapshot`
  - `ScrapeAttempt`
  - `Notification`
- Private credentials-based auth with NextAuth, email allowlist, and one fixed password
- API routes to create/list watches, refresh a single watch, and run due weekly checks
- Mobile-first dashboard UI for adding products, choosing variants, and viewing price history
- Scheduled worker route ready for Vercel Cron Jobs
- Parser tests for the Douglas HTML extraction logic

## Local setup

Install dependencies:

```bash
npm install
```

Copy the env template and point `DATABASE_URL` at a Postgres database:

```bash
cp .env.example .env.local
cp .env.example .env
```

Generate the Prisma client if needed:

```bash
npm run prisma:generate
```

Apply the checked-in migration to your Postgres database:

```bash
npm run prisma:migrate:deploy
```

Start the app:

```bash
npm run dev
```

Open `http://localhost:3000`.

## Environment

Required:

- `DATABASE_URL`
- `DIRECT_URL`

Required for private sign-in:

- `NEXTAUTH_URL`
- `NEXTAUTH_SECRET`
- `AUTH_ALLOWED_EMAILS`
- `AUTH_FIXED_PASSWORD`

Optional:

- `CRON_SECRET`
- `RESEND_API_KEY`
- `VIKCHE_ALERT_FROM`
- `VIKCHE_ALERT_TO`
- `OPENAI_API_KEY`
- `OPENAI_MODEL`
- `ZYTE_API_KEY`

If no Resend credentials are configured, notifications are still created and marked as `logged`.
Vikche uses an allowlisted email list plus one fixed password from env for private access.

## Scraping

Vikche first tries a direct HTTP fetch. If the store blocks the request or returns a challenge page, Vikche retries through Zyte and then interprets the HTML.

Generic stores are interpreted through OpenAI after the HTML is fetched. Douglas continues to use its dedicated parser on top of the fetched HTML.

For blocked stores, configure:

- `ZYTE_API_KEY`

## Worker

Run due weekly checks manually:

```bash
npm run worker:due
```

This refreshes store products whose last successful check is older than 7 days.
Products stuck in an error state are skipped by the automatic cron and can be retried manually from the UI.

## Vercel + Neon deployment

Recommended production setup:

- Vercel for the Next.js app
- Neon for PostgreSQL

### 1. Create a Neon project

Create a Neon database and copy two connection strings from the Connect modal:

- a pooled connection string for `DATABASE_URL`
- a direct connection string for `DIRECT_URL`

For Prisma with Neon:

- `DATABASE_URL` should use the pooled host (`-pooler`)
- `DIRECT_URL` should use the direct host

### 2. Run migrations against Neon

Before deploying, point your local env vars at Neon and run:

```bash
npm run prisma:migrate:deploy
```

This creates the production schema in Neon.

### 3. Create the Vercel project

Import the Git repository into Vercel.

Set these environment variables in Vercel:

- `DATABASE_URL`
- `DIRECT_URL`
- `NEXTAUTH_URL`
- `NEXTAUTH_SECRET`
- `AUTH_ALLOWED_EMAILS`
- `AUTH_FIXED_PASSWORD`
- `CRON_SECRET`
- `RESEND_API_KEY` if you want email delivery
- `VIKCHE_ALERT_FROM` if you want email delivery

For `NEXTAUTH_URL`, use your production domain, for example:

```env
NEXTAUTH_URL="https://vikche.vercel.app"
```

### 4. Private access setup

Set `AUTH_ALLOWED_EMAILS` to a comma-separated allowlist, for example:

```env
AUTH_ALLOWED_EMAILS="you@example.com,friend@example.com"
```

Set one fixed shared password:

```env
AUTH_FIXED_PASSWORD="choose-a-strong-password"
```

### 5. Cron schedule

The repo includes [vercel.json](/Users/daniel/vikche/vercel.json), which schedules:

- `/api/admin/run-due-checks`
- once per day at `08:00 UTC`

The cron still runs daily, but it only refreshes products that are due for their weekly check.

The route accepts `GET` so Vercel Cron can trigger it, and it checks `CRON_SECRET` when that variable is configured.

### 6. Test email delivery

When `RESEND_API_KEY` and `VIKCHE_ALERT_FROM` are configured, you can send a manual test email through:

```bash
curl -X POST http://localhost:3000/api/admin/test-email \
  -H "Authorization: Bearer $CRON_SECRET" \
  -H "Content-Type: application/json" \
  -d '{}'
```

This route always sends to `VIKCHE_ALERT_TO`.

## Tests

```bash
npm test
npm run lint
npm run build
```
