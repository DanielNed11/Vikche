# Vikche

Vikche is a Douglas-first price tracker built as a Next.js web app. It accepts `douglas.bg` product URLs, stores tracked items in PostgreSQL through Prisma, uses an HTTP scraper for Douglas, keeps price history, and logs or emails price-drop notifications.

## What is implemented
- Douglas connector with URL validation and canonicalization
- HTTP scraping for Douglas product pages
- Prisma/PostgreSQL persistence with multi-store-ready core tables:
  - `Retailer`
  - `StoreProduct`
  - `ProductWatch`
  - `PriceSnapshot`
  - `ScrapeAttempt`
  - `Notification`
- Google SSO with NextAuth and Prisma-backed users
- Apple sign-in path ready behind env configuration
- API routes to create/list watches, refresh a single watch, and run due daily checks
- Mobile-first dashboard UI for adding products, choosing Douglas shades, and viewing price history
- Daily worker route ready for Vercel Cron Jobs
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

Recommended for SSO:

- `NEXTAUTH_URL`
- `NEXTAUTH_SECRET`
- `GOOGLE_CLIENT_ID`
- `GOOGLE_CLIENT_SECRET`

Optional:

- `CRON_SECRET`
- `RESEND_API_KEY`
- `VIKCHE_ALERT_FROM`
- `VIKCHE_ALERT_TO`
- `APPLE_ID`
- `APPLE_SECRET`

If no Resend credentials are configured, notifications are still created and marked as `logged`.
If Google OAuth is not configured, Vikche still requires sign-in, and no local fallback login is available.

## Scraping

Vikche currently uses the HTTP Douglas extractor only. If a retailer later needs browser automation, that can be added back as a separate deployment decision.

## Worker

Run due daily checks manually:

```bash
npm run worker:due
```

This refreshes store products whose last successful check is older than 24 hours.

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
- `GOOGLE_CLIENT_ID`
- `GOOGLE_CLIENT_SECRET`
- `CRON_SECRET`
- `RESEND_API_KEY` if you want email delivery
- `VIKCHE_ALERT_FROM` if you want email delivery

For `NEXTAUTH_URL`, use your production domain, for example:

```env
NEXTAUTH_URL="https://vikche.vercel.app"
```

### 4. Update Google OAuth

Add your production callback URL in Google Cloud:

```text
https://YOUR_DOMAIN/api/auth/callback/google
```

If you keep local development, also keep:

```text
http://localhost:3000/api/auth/callback/google
```

### 5. Cron schedule

The repo includes [vercel.json](/Users/daniel/vikche/vercel.json), which schedules:

- `/api/admin/run-due-checks`
- once per day at `08:00 UTC`

The route accepts `GET` so Vercel Cron can trigger it, and it checks `CRON_SECRET` when that variable is configured.

## Tests

```bash
npm test
npm run lint
npm run build
```
