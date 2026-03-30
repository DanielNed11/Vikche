-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "public"."RetailerSlug" AS ENUM ('DOUGLAS');

-- CreateEnum
CREATE TYPE "public"."ExtractorKind" AS ENUM ('HTTP', 'PLAYWRIGHT');

-- CreateEnum
CREATE TYPE "public"."WatchStatus" AS ENUM ('PENDING', 'OK', 'ERROR');

-- CreateEnum
CREATE TYPE "public"."NotificationKind" AS ENUM ('PRICE_DROP');

-- CreateEnum
CREATE TYPE "public"."NotificationChannel" AS ENUM ('EMAIL', 'LOG');

-- CreateEnum
CREATE TYPE "public"."NotificationStatus" AS ENUM ('QUEUED', 'SENT', 'LOGGED', 'FAILED');

-- CreateEnum
CREATE TYPE "public"."CurrencyCode" AS ENUM ('EUR');

-- CreateTable
CREATE TABLE "public"."User" (
    "id" TEXT NOT NULL,
    "name" TEXT,
    "email" TEXT,
    "emailVerified" TIMESTAMP(3),
    "image" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."Account" (
    "userId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "providerAccountId" TEXT NOT NULL,
    "refresh_token" TEXT,
    "access_token" TEXT,
    "expires_at" INTEGER,
    "token_type" TEXT,
    "scope" TEXT,
    "id_token" TEXT,
    "session_state" TEXT,

    CONSTRAINT "Account_pkey" PRIMARY KEY ("provider","providerAccountId")
);

-- CreateTable
CREATE TABLE "public"."Session" (
    "sessionToken" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "expires" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Session_pkey" PRIMARY KEY ("sessionToken")
);

-- CreateTable
CREATE TABLE "public"."VerificationToken" (
    "identifier" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "expires" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "VerificationToken_pkey" PRIMARY KEY ("identifier","token")
);

-- CreateTable
CREATE TABLE "public"."Retailer" (
    "id" TEXT NOT NULL,
    "slug" "public"."RetailerSlug" NOT NULL,
    "name" TEXT NOT NULL,
    "baseUrl" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Retailer_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."StoreProduct" (
    "id" TEXT NOT NULL,
    "retailerId" TEXT NOT NULL,
    "canonicalUrl" TEXT NOT NULL,
    "productUrl" TEXT NOT NULL,
    "externalProductCode" TEXT NOT NULL,
    "externalMasterProductCode" TEXT,
    "title" TEXT,
    "brand" TEXT,
    "variantLabel" TEXT,
    "variantText" TEXT,
    "imageUrl" TEXT,
    "currentPrice" DECIMAL(65,30),
    "originalPrice" DECIMAL(65,30),
    "currency" "public"."CurrencyCode" NOT NULL DEFAULT 'EUR',
    "inStock" BOOLEAN,
    "lastCheckedAt" TIMESTAMP(3),
    "lastStatus" "public"."WatchStatus" NOT NULL DEFAULT 'PENDING',
    "lastError" TEXT,
    "lastExtractor" "public"."ExtractorKind",
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StoreProduct_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."ProductWatch" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "storeProductId" TEXT NOT NULL,
    "lastNotifiedSnapshotId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProductWatch_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."PriceSnapshot" (
    "id" TEXT NOT NULL,
    "storeProductId" TEXT NOT NULL,
    "price" DECIMAL(65,30) NOT NULL,
    "originalPrice" DECIMAL(65,30),
    "currency" "public"."CurrencyCode" NOT NULL DEFAULT 'EUR',
    "inStock" BOOLEAN NOT NULL,
    "extractor" "public"."ExtractorKind" NOT NULL,
    "scrapedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PriceSnapshot_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."ScrapeAttempt" (
    "id" TEXT NOT NULL,
    "storeProductId" TEXT NOT NULL,
    "extractor" "public"."ExtractorKind" NOT NULL,
    "ok" BOOLEAN NOT NULL,
    "error" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ScrapeAttempt_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."Notification" (
    "id" TEXT NOT NULL,
    "productWatchId" TEXT NOT NULL,
    "kind" "public"."NotificationKind" NOT NULL DEFAULT 'PRICE_DROP',
    "channel" "public"."NotificationChannel" NOT NULL DEFAULT 'LOG',
    "status" "public"."NotificationStatus" NOT NULL DEFAULT 'QUEUED',
    "previousSnapshotId" TEXT NOT NULL,
    "triggeringSnapshotId" TEXT NOT NULL,
    "deliveryError" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deliveredAt" TIMESTAMP(3),

    CONSTRAINT "Notification_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "public"."User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "Session_sessionToken_key" ON "public"."Session"("sessionToken");

-- CreateIndex
CREATE UNIQUE INDEX "Retailer_slug_key" ON "public"."Retailer"("slug");

-- CreateIndex
CREATE INDEX "StoreProduct_retailerId_canonicalUrl_idx" ON "public"."StoreProduct"("retailerId", "canonicalUrl");

-- CreateIndex
CREATE UNIQUE INDEX "StoreProduct_retailerId_externalProductCode_key" ON "public"."StoreProduct"("retailerId", "externalProductCode");

-- CreateIndex
CREATE INDEX "ProductWatch_storeProductId_idx" ON "public"."ProductWatch"("storeProductId");

-- CreateIndex
CREATE UNIQUE INDEX "ProductWatch_userId_storeProductId_key" ON "public"."ProductWatch"("userId", "storeProductId");

-- CreateIndex
CREATE INDEX "PriceSnapshot_storeProductId_scrapedAt_idx" ON "public"."PriceSnapshot"("storeProductId", "scrapedAt" DESC);

-- CreateIndex
CREATE INDEX "ScrapeAttempt_storeProductId_createdAt_idx" ON "public"."ScrapeAttempt"("storeProductId", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "Notification_productWatchId_createdAt_idx" ON "public"."Notification"("productWatchId", "createdAt" DESC);

-- CreateIndex
CREATE UNIQUE INDEX "Notification_productWatchId_triggeringSnapshotId_kind_key" ON "public"."Notification"("productWatchId", "triggeringSnapshotId", "kind");

-- AddForeignKey
ALTER TABLE "public"."Account" ADD CONSTRAINT "Account_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Session" ADD CONSTRAINT "Session_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."StoreProduct" ADD CONSTRAINT "StoreProduct_retailerId_fkey" FOREIGN KEY ("retailerId") REFERENCES "public"."Retailer"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."ProductWatch" ADD CONSTRAINT "ProductWatch_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."ProductWatch" ADD CONSTRAINT "ProductWatch_storeProductId_fkey" FOREIGN KEY ("storeProductId") REFERENCES "public"."StoreProduct"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."ProductWatch" ADD CONSTRAINT "ProductWatch_lastNotifiedSnapshotId_fkey" FOREIGN KEY ("lastNotifiedSnapshotId") REFERENCES "public"."PriceSnapshot"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."PriceSnapshot" ADD CONSTRAINT "PriceSnapshot_storeProductId_fkey" FOREIGN KEY ("storeProductId") REFERENCES "public"."StoreProduct"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."ScrapeAttempt" ADD CONSTRAINT "ScrapeAttempt_storeProductId_fkey" FOREIGN KEY ("storeProductId") REFERENCES "public"."StoreProduct"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Notification" ADD CONSTRAINT "Notification_productWatchId_fkey" FOREIGN KEY ("productWatchId") REFERENCES "public"."ProductWatch"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Notification" ADD CONSTRAINT "Notification_previousSnapshotId_fkey" FOREIGN KEY ("previousSnapshotId") REFERENCES "public"."PriceSnapshot"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Notification" ADD CONSTRAINT "Notification_triggeringSnapshotId_fkey" FOREIGN KEY ("triggeringSnapshotId") REFERENCES "public"."PriceSnapshot"("id") ON DELETE CASCADE ON UPDATE CASCADE;
