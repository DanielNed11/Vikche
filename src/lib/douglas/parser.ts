import { load } from "cheerio";

import { AppError } from "@/lib/http-error";
import type {
  ResolvedConfigurableProduct,
  ResolvedDouglasProduct,
  ResolvedVariantChoice,
  ScrapedProductSnapshot,
} from "@/lib/types";

interface DouglasSimplePayload {
  primary_product_id?: unknown;
  primary_product_master_id?: unknown;
  primary_product_price?: unknown;
  primary_product_price_regular?: unknown;
  primary_product_variant_name?: unknown;
  primary_product_color?: unknown;
  primary_product_size?: unknown;
  primary_product_availability_status?: unknown;
}

interface DouglasUtagPayload extends DouglasSimplePayload {
  currency?: unknown;
  primary_product_master_name?: unknown;
  simpleProducts?: Record<string, DouglasSimplePayload>;
}

interface ConfigurableOptionConfig {
  attributes?: Record<
    string,
    {
      options?: Array<{
        id?: string;
        label?: string;
        products?: string[];
      }>;
    }
  >;
  optionPrices?: Record<
    string,
    {
      oldPrice?: { amount?: number };
      finalPrice?: { amount?: number };
      baseOldPrice?: { amount?: number };
      basePrice?: { amount?: number };
    }
  >;
  images?: Record<
    string,
    Array<{
      full?: string | null;
      img?: string | null;
      thumb?: string | null;
      isMain?: boolean;
    }>
  >;
  sku?: Record<string, string>;
  salable_product?: Record<string, { is_salable?: boolean }>;
  default_selected_product_id?: string | null;
}

function normalizeText(value: string | undefined | null) {
  return value?.replace(/\u00a0/g, " ").replace(/\s+/g, " ").trim() ?? "";
}

function firstText(values: unknown): string | null {
  if (typeof values === "string") {
    const normalized = normalizeText(values);
    return normalized || null;
  }

  if (Array.isArray(values)) {
    for (const value of values) {
      if (typeof value !== "string") {
        continue;
      }

      const normalized = normalizeText(value);

      if (normalized && normalized.toLowerCase() !== "none") {
        return normalized;
      }
    }
  }

  return null;
}

function parseDisplayedEuro(value: string) {
  const match = normalizeText(value).match(/([\d\s.,]+)\s*€/i);

  if (!match) {
    return null;
  }

  const parsed = Number.parseFloat(
    match[1].replace(/\s+/g, "").replace(/\./g, "").replace(",", "."),
  );

  return Number.isFinite(parsed) ? parsed : null;
}

function parseNumericPrice(value: unknown) {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === "string") {
    const parsed = Number.parseFloat(value);
    return Number.isFinite(parsed) ? parsed : null;
  }

  return null;
}

function parseAvailability(value: string | null) {
  if (!value) {
    return null;
  }

  const normalized = value.toLowerCase();

  if (
    normalized.includes("out of stock") ||
    normalized.includes("няма наличност") ||
    normalized.includes("not available")
  ) {
    return false;
  }

  if (
    normalized.includes("in stock") ||
    normalized.includes("available") ||
    normalized.includes("в наличност") ||
    normalized.includes("наличен")
  ) {
    return true;
  }

  return null;
}

function normalizeOldPrice(currentPrice: number, originalPrice: number | null) {
  if (originalPrice === null) {
    return null;
  }

  return originalPrice > currentPrice ? originalPrice : null;
}

function findJsonObjectStart(source: string, searchFrom: number) {
  for (let index = searchFrom; index < source.length; index += 1) {
    if (source[index] === "{") {
      return index;
    }
  }

  return -1;
}

function extractBalancedJsonObject(source: string, startIndex: number) {
  let depth = 0;
  let inString = false;
  let escaped = false;

  for (let index = startIndex; index < source.length; index += 1) {
    const character = source[index];

    if (inString) {
      if (escaped) {
        escaped = false;
        continue;
      }

      if (character === "\\") {
        escaped = true;
        continue;
      }

      if (character === '"') {
        inString = false;
      }

      continue;
    }

    if (character === '"') {
      inString = true;
      continue;
    }

    if (character === "{") {
      depth += 1;
      continue;
    }

    if (character === "}") {
      depth -= 1;

      if (depth === 0) {
        return source.slice(startIndex, index + 1);
      }
    }
  }

  throw new AppError(502, "Вградените данни на Douglas са непълни.");
}

function extractJsonAfterMarker<T>(html: string, marker: string) {
  const markerIndex = html.indexOf(marker);

  if (markerIndex === -1) {
    return null;
  }

  const startIndex = findJsonObjectStart(html, markerIndex + marker.length);

  if (startIndex === -1) {
    return null;
  }

  try {
    const json = extractBalancedJsonObject(html, startIndex);
    return JSON.parse(json) as T;
  } catch {
    throw new AppError(502, "Не успяхме да разчетем данните от страницата на Douglas.");
  }
}

function getTitle($: ReturnType<typeof load>) {
  return (
    normalizeText($(".product-view-custom-title h1[itemprop='name']").first().text()) ||
    normalizeText($("h1[itemprop='name']").first().text())
  );
}

function getVisibleVariantText($: ReturnType<typeof load>) {
  return (
    normalizeText($("#weight-container").first().text()) ||
    normalizeText($("#product-attributes .value.size").first().text()) ||
    null
  );
}

function getVisibilityPayload(html: string) {
  return extractJsonAfterMarker<DouglasUtagPayload>(html, "utag_data:");
}

function getConfigurablePayload(html: string) {
  return extractJsonAfterMarker<ConfigurableOptionConfig>(
    html,
    "initConfigurableOptions(",
  );
}

function getPriceFromOption(config: ConfigurableOptionConfig, productId: string) {
  const optionPrice = config.optionPrices?.[productId];
  const currentPrice =
    parseNumericPrice(optionPrice?.finalPrice?.amount) ??
    parseNumericPrice(optionPrice?.basePrice?.amount);

  if (currentPrice === null) {
    return null;
  }

  const originalPrice = normalizeOldPrice(
    currentPrice,
    parseNumericPrice(optionPrice?.oldPrice?.amount) ??
      parseNumericPrice(optionPrice?.baseOldPrice?.amount),
  );

  return {
    price: currentPrice,
    originalPrice,
  };
}

function getVariantImage(config: ConfigurableOptionConfig, productId: string) {
  const images = config.images?.[productId];

  if (!Array.isArray(images) || images.length === 0) {
    return null;
  }

  const mainImage = images.find((entry) => entry.isMain) ?? images[0];

  return mainImage.full ?? mainImage.img ?? mainImage.thumb ?? null;
}

function getVariantPayload(
  simpleProducts: Record<string, DouglasSimplePayload> | undefined,
  productId: string,
  variantCode: string,
) {
  if (!simpleProducts) {
    return null;
  }

  return (
    simpleProducts[`id-${productId}`] ??
    simpleProducts[variantCode] ??
    null
  );
}

function buildConfigurableVariants(
  config: ConfigurableOptionConfig,
  utagData: DouglasUtagPayload | null,
  fallbackVariantText: string | null,
) {
  const variants: ResolvedVariantChoice[] = [];
  const seenCodes = new Set<string>();
  const simpleProducts = utagData?.simpleProducts;
  const attributes = Object.values(config.attributes ?? {});

  for (const attribute of attributes) {
    for (const option of attribute.options ?? []) {
      const productId = option.products?.[0];

      if (!productId) {
        continue;
      }

      const variantCode =
        config.sku?.[productId] ??
        firstText(
          getVariantPayload(simpleProducts, productId, productId)?.primary_product_id,
        );

      if (!variantCode || seenCodes.has(variantCode)) {
        continue;
      }

      const simpleProduct = getVariantPayload(simpleProducts, productId, variantCode);
      const priceFromConfig = getPriceFromOption(config, productId);
      const currentPrice =
        priceFromConfig?.price ??
        parseNumericPrice(firstText(simpleProduct?.primary_product_price));

      if (currentPrice === null) {
        continue;
      }

      const variantLabel =
        normalizeText(option.label) ||
        firstText(simpleProduct?.primary_product_variant_name) ||
        firstText(simpleProduct?.primary_product_color);
      const variantText =
        firstText(simpleProduct?.primary_product_size) ?? fallbackVariantText;
      const originalPrice = normalizeOldPrice(
        currentPrice,
        priceFromConfig?.originalPrice ??
          parseNumericPrice(firstText(simpleProduct?.primary_product_price_regular)),
      );
      const salableFlag = config.salable_product?.[productId]?.is_salable;
      const inStock =
        typeof salableFlag === "boolean"
          ? salableFlag
          : parseAvailability(
              firstText(simpleProduct?.primary_product_availability_status),
            ) ?? true;

      variants.push({
        variantCode,
        variantLabel: variantLabel || null,
        variantText,
        price: currentPrice,
        originalPrice,
        currency: "EUR",
        inStock,
        imageUrl: getVariantImage(config, productId),
      });
      seenCodes.add(variantCode);
    }
  }

  return variants;
}

function resolveSimpleProduct(
  $: ReturnType<typeof load>,
  canonicalUrl: string,
  utagData: DouglasUtagPayload | null,
): ResolvedDouglasProduct {
  const title = getTitle($) || firstText(utagData?.primary_product_master_name);
  const productCode =
    firstText(utagData?.primary_product_id) ||
    normalizeText($(".product-info-main .sku-code").first().text()) ||
    normalizeText($("meta[property='og:retailer_item_id']").attr("content"));
  const visibleCurrentPrice = parseDisplayedEuro(
    $(".product-info-main .price-box .final-price .price-wrapper .price")
      .first()
      .text(),
  );
  const visibleOriginalPrice = parseDisplayedEuro(
    $(".product-info-main .price-box .old-price .price-wrapper .price").first().text(),
  );
  const currentPrice =
    visibleCurrentPrice ??
    parseNumericPrice(firstText(utagData?.primary_product_price)) ??
    parseNumericPrice($(".product-info-main [itemprop='price']").first().attr("content"));

  if (!title || !productCode || currentPrice === null) {
    throw new AppError(
      502,
      "Страницата на Douglas не съдържа нужните данни за продукта.",
    );
  }

  const originalPrice = normalizeOldPrice(
    currentPrice,
    visibleOriginalPrice ??
      parseNumericPrice(firstText(utagData?.primary_product_price_regular)),
  );
  const availability =
    parseAvailability(
      normalizeText($("meta[property='og:availability']").attr("content")),
    ) ??
    parseAvailability(
      normalizeText($(".product-info-main .stock.stock-availability").first().text()),
    ) ??
    parseAvailability(firstText(utagData?.primary_product_availability_status)) ??
    true;

  return {
    kind: "simple",
    retailer: "douglas",
    canonicalUrl,
    productUrl: canonicalUrl,
    title,
    productCode,
    masterProductCode: null,
    variantLabel: null,
    price: currentPrice,
    originalPrice,
    currency: "EUR",
    inStock: availability,
    imageUrl:
      normalizeText($("meta[property='og:image']").attr("content")) || null,
    variantText:
      getVisibleVariantText($) ?? firstText(utagData?.primary_product_size) ?? null,
  };
}

function resolveConfigurableProduct(
  $: ReturnType<typeof load>,
  canonicalUrl: string,
  utagData: DouglasUtagPayload | null,
  config: ConfigurableOptionConfig,
): ResolvedConfigurableProduct {
  const title = getTitle($) || firstText(utagData?.primary_product_master_name);
  const masterProductCode =
    firstText(utagData?.primary_product_master_id) ||
    normalizeText($(".product-info-main .sku-code").first().text());

  if (!title || !masterProductCode) {
    throw new AppError(
      502,
      "Данните за този продукт от Douglas са непълни.",
    );
  }

  const fallbackVariantText =
    getVisibleVariantText($) ?? firstText(utagData?.primary_product_size) ?? null;
  const variants = buildConfigurableVariants(config, utagData, fallbackVariantText);

  if (variants.length === 0) {
    throw new AppError(
      502,
      "Не успяхме да открием вариантите на този продукт в Douglas.",
    );
  }

  const defaultVariantCode =
    (config.default_selected_product_id
      ? config.sku?.[config.default_selected_product_id]
      : null) ??
    firstText(utagData?.primary_product_id);
  const defaultVariant =
    variants.find((variant) => variant.variantCode === defaultVariantCode) ??
    variants[0];

  return {
    kind: "configurable",
    retailer: "douglas",
    canonicalUrl,
    productUrl: canonicalUrl,
    title,
    masterProductCode,
    imageUrl:
      defaultVariant.imageUrl ??
      normalizeText($("meta[property='og:image']").attr("content")) ??
      null,
    defaultVariantCode: defaultVariantCode ?? defaultVariant.variantCode,
    variants,
  };
}

export function resolveDouglasProductHtml(
  html: string,
  canonicalUrl: string,
): ResolvedDouglasProduct {
  const $ = load(html);
  const utagData = getVisibilityPayload(html);
  const configurable = getConfigurablePayload(html);

  if (configurable?.attributes && Object.keys(configurable.attributes).length > 0) {
    return resolveConfigurableProduct($, canonicalUrl, utagData, configurable);
  }

  return resolveSimpleProduct($, canonicalUrl, utagData);
}

export function buildDouglasSnapshot(
  resolved: ResolvedDouglasProduct,
  extractor: "http" | "playwright",
  variantCode?: string,
): ScrapedProductSnapshot {
  if (resolved.kind === "simple") {
    return {
      retailer: resolved.retailer,
      canonicalUrl: resolved.canonicalUrl,
      productUrl: resolved.productUrl,
      title: resolved.title,
      productCode: resolved.productCode,
      masterProductCode: resolved.masterProductCode,
      variantLabel: resolved.variantLabel,
      price: resolved.price,
      originalPrice: resolved.originalPrice,
      currency: "EUR",
      inStock: resolved.inStock,
      imageUrl: resolved.imageUrl,
      variantText: resolved.variantText,
      extractor,
      scrapedAt: new Date().toISOString(),
    };
  }

  if (!variantCode) {
    throw new AppError(400, "Избери нюанс, преди да запазиш продукта.");
  }

  const variant = resolved.variants.find((entry) => entry.variantCode === variantCode);

  if (!variant) {
    throw new AppError(
      409,
      `Вариантът ${variantCode} не беше открит на страницата на продукта.`,
    );
  }

  return {
    retailer: resolved.retailer,
    canonicalUrl: resolved.canonicalUrl,
    productUrl: resolved.productUrl,
    title: resolved.title,
    productCode: variant.variantCode,
    masterProductCode: resolved.masterProductCode,
    variantLabel: variant.variantLabel,
    price: variant.price,
    originalPrice: variant.originalPrice,
    currency: "EUR",
    inStock: variant.inStock,
    imageUrl: variant.imageUrl ?? resolved.imageUrl,
    variantText: variant.variantText,
    extractor,
    scrapedAt: new Date().toISOString(),
  };
}
