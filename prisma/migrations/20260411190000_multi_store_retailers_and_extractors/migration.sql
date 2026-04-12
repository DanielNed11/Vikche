ALTER TYPE "ExtractorKind" ADD VALUE IF NOT EXISTS 'SCRAPFLY';

ALTER TABLE "PriceSnapshot"
ALTER COLUMN "inStock" DROP NOT NULL;

ALTER TABLE "Retailer"
ALTER COLUMN "slug" TYPE TEXT USING lower("slug"::text);

DROP TYPE "RetailerSlug";

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM "Retailer" WHERE "slug" = 'douglas')
    AND NOT EXISTS (SELECT 1 FROM "Retailer" WHERE "slug" = 'douglas.bg') THEN
    UPDATE "Retailer"
    SET "slug" = 'douglas.bg'
    WHERE "slug" = 'douglas';
  END IF;
END $$;

UPDATE "Retailer"
SET
  "name" = 'Douglas',
  "baseUrl" = 'https://douglas.bg',
  "active" = true
WHERE "slug" = 'douglas.bg';
