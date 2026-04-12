import { load } from "cheerio";

import { extractDiscountCodeFromText } from "@/lib/discount-code";
import { AppError } from "@/lib/http-error";
import type {
  ExtractorKind,
  ResolvedSimpleProduct,
  ScrapedProductSnapshot,
} from "@/lib/types";

function normalizeText(value: string | undefined | null) {
  return value?.replace(/\u00a0/g, " ").replace(/\s+/g, " ").trim() ?? "";
}

function normalizeImageUrl(value: string | undefined | null, baseUrl: string) {
  const normalized = normalizeText(value);

  if (!normalized) {
    return null;
  }

  try {
    return new URL(normalized, baseUrl).toString();
  } catch {
    return null;
  }
}

function parseEuroValue(value: string | undefined | null) {
  const normalized = normalizeText(value);

  if (!normalized) {
    return null;
  }

  const match = normalized.match(/([\d\s.,]+)\s*€/i);

  if (!match) {
    return null;
  }

  const parsed = Number.parseFloat(
    match[1].replace(/\s+/g, "").replace(/\./g, "").replace(",", "."),
  );

  return Number.isFinite(parsed) ? parsed : null;
}

function parseNumberish(value: unknown) {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === "string") {
    const parsed = Number.parseFloat(value.replace(",", "."));
    return Number.isFinite(parsed) ? parsed : null;
  }

  return null;
}

function normalizeOldPrice(currentPrice: number, originalPrice: number | null) {
  if (originalPrice === null) {
    return null;
  }

  return originalPrice > currentPrice ? originalPrice : null;
}

function parseAvailability(value: string | null) {
  if (!value) {
    return null;
  }

  const normalized = value.toLowerCase();

  if (
    normalized.includes("out of stock") ||
    normalized.includes("outofstock") ||
    normalized.includes("sold out") ||
    normalized.includes("изчерпан") ||
    normalized.includes("няма наличност") ||
    normalized.includes("not available")
  ) {
    return false;
  }

  if (
    normalized.includes("in stock") ||
    normalized.includes("instock") ||
    normalized.includes("available") ||
    normalized.includes("в наличност") ||
    normalized.includes("наличен")
  ) {
    return true;
  }

  return null;
}

function parseJsonLdBlocks($: ReturnType<typeof load>) {
  const blocks: unknown[] = [];

  $("script[type='application/ld+json']").each((_, element) => {
    const raw = normalizeText($(element).html());

    if (!raw) {
      return;
    }

    try {
      blocks.push(JSON.parse(raw) as unknown);
    } catch {
      // Ignore malformed JSON-LD blocks.
    }
  });

  return blocks;
}

type GenericProductData = {
  title: string | null;
  imageUrl: string | null;
  productCode: string | null;
  price: number | null;
  originalPrice: number | null;
  inStock: boolean | null;
  discountCode: string | null;
};

function firstString(value: unknown): string | null {
  if (typeof value === "string") {
    const normalized = normalizeText(value);
    return normalized || null;
  }

  if (Array.isArray(value)) {
    for (const entry of value) {
      const candidate = firstString(entry);

      if (candidate) {
        return candidate;
      }
    }
  }

  return null;
}

function firstImage(value: unknown, baseUrl: string): string | null {
  if (typeof value === "string") {
    return normalizeImageUrl(value, baseUrl);
  }

  if (Array.isArray(value)) {
    for (const entry of value) {
      const candidate = firstImage(entry, baseUrl);

      if (candidate) {
        return candidate;
      }
    }
  }

  return null;
}

function getNestedPriceSpecificationPrice(value: unknown) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }

  const record = value as Record<string, unknown>;
  return parseNumberish(record.price);
}

function findProductData(value: unknown, baseUrl: string): GenericProductData | null {
  if (!value || typeof value !== "object") {
    return null;
  }

  if (Array.isArray(value)) {
    for (const entry of value) {
      const candidate = findProductData(entry, baseUrl);

      if (candidate?.price !== null) {
        return candidate;
      }
    }

    return null;
  }

  const record = value as Record<string, unknown>;
  const typeValue = record["@type"];
  const types = Array.isArray(typeValue)
    ? typeValue.map((entry) => String(entry))
    : typeof typeValue === "string"
      ? [typeValue]
      : [];

  const isProduct = types.some((entry) => entry.toLowerCase() === "product");

  if (isProduct) {
    const offerValue = record.offers;
    const offers = Array.isArray(offerValue) ? offerValue : offerValue ? [offerValue] : [];
    const euroOffer = offers.find((offer) => {
      if (!offer || typeof offer !== "object") {
        return false;
      }

      const offerRecord = offer as Record<string, unknown>;
      const currency = firstString(offerRecord.priceCurrency);

      return !currency || currency.toUpperCase() === "EUR";
    }) as Record<string, unknown> | undefined;
    const currentPrice =
      parseNumberish(euroOffer?.price) ??
      parseNumberish(record.price) ??
      null;
    const rawOriginalPrice =
      parseNumberish(euroOffer?.highPrice) ??
      getNestedPriceSpecificationPrice(euroOffer?.priceSpecification) ??
      parseNumberish(record.highPrice);

    return {
      title: firstString(record.name),
      imageUrl: firstImage(record.image, baseUrl),
      productCode:
        firstString(record.sku) ??
        firstString(record.mpn) ??
        firstString(record.gtin13) ??
        firstString(record.productID),
      price: currentPrice,
      originalPrice:
        currentPrice !== null ? normalizeOldPrice(currentPrice, rawOriginalPrice) : null,
      inStock:
        parseAvailability(firstString(euroOffer?.availability)) ??
        parseAvailability(firstString(record.availability)),
      discountCode: null,
    };
  }

  for (const nested of Object.values(record)) {
    const candidate = findProductData(nested, baseUrl);

    if (candidate?.price !== null) {
      return candidate;
    }
  }

  return null;
}

function getFallbackTitle($: ReturnType<typeof load>) {
  return (
    normalizeText($("meta[property='og:title']").attr("content")) ||
    normalizeText($("h1").first().text()) ||
    normalizeText($("title").first().text()) ||
    null
  );
}

function getFallbackImage($: ReturnType<typeof load>, baseUrl: string) {
  return (
    normalizeImageUrl($("meta[property='og:image:secure_url']").attr("content"), baseUrl) ??
    normalizeImageUrl($("meta[property='og:image:url']").attr("content"), baseUrl) ??
    normalizeImageUrl($("meta[property='og:image']").attr("content"), baseUrl)
  );
}

function getFallbackPrice($: ReturnType<typeof load>) {
  return (
    parseEuroValue($("meta[property='product:price:amount']").attr("content")) ??
    parseEuroValue($("[itemprop='price']").first().attr("content")) ??
    parseEuroValue($("[itemprop='price']").first().text()) ??
    parseEuroValue($(".price").first().text()) ??
    parseEuroValue($.text())
  );
}

function getFallbackAvailability($: ReturnType<typeof load>) {
  return (
    parseAvailability(normalizeText($("meta[property='og:availability']").attr("content"))) ??
    parseAvailability(normalizeText($("[itemprop='availability']").first().attr("href"))) ??
    parseAvailability(normalizeText($("[data-stock]").first().text())) ??
    parseAvailability(normalizeText($("body").text()))
  );
}

function deriveProductCode(url: string) {
  const parsed = new URL(url);
  return `${parsed.hostname}${parsed.pathname}${parsed.search}`;
}

export function resolveGenericProductHtml(
  html: string,
  canonicalUrl: string,
): ResolvedSimpleProduct {
  const $ = load(html);
  const jsonLdProduct = parseJsonLdBlocks($)
    .map((block) => findProductData(block, canonicalUrl))
    .find((block) => block?.price !== null);
  const title = jsonLdProduct?.title ?? getFallbackTitle($);
  const price = jsonLdProduct?.price ?? getFallbackPrice($);

  if (!title || price === null) {
    throw new AppError(422, "Не успяхме да разчетем този продуктов линк.");
  }

  return {
    kind: "simple",
    retailer: new URL(canonicalUrl).hostname.replace(/^www\./, ""),
    canonicalUrl,
    productUrl: canonicalUrl,
    title,
    productCode: jsonLdProduct?.productCode ?? deriveProductCode(canonicalUrl),
    masterProductCode: null,
    variantLabel: null,
    price,
    originalPrice: normalizeOldPrice(
      price,
      jsonLdProduct?.originalPrice ?? null,
    ),
    discountCode: extractDiscountCodeFromText($("body").text()),
    currency: "EUR",
    inStock: jsonLdProduct?.inStock ?? getFallbackAvailability($) ?? null,
    imageUrl: jsonLdProduct?.imageUrl ?? getFallbackImage($, canonicalUrl),
    variantText: null,
  };
}

export function buildGenericSnapshot(
  resolved: ResolvedSimpleProduct,
  extractor: ExtractorKind,
): ScrapedProductSnapshot {
  return {
    retailer: resolved.retailer,
    canonicalUrl: resolved.canonicalUrl,
    productUrl: resolved.productUrl,
    title: resolved.title,
    productCode: resolved.productCode,
    masterProductCode: null,
    variantLabel: null,
    price: resolved.price,
    originalPrice: resolved.originalPrice,
    discountCode: resolved.discountCode,
    currency: "EUR",
    inStock: resolved.inStock,
    imageUrl: resolved.imageUrl,
    variantText: null,
    extractor,
    scrapedAt: new Date().toISOString(),
  };
}
