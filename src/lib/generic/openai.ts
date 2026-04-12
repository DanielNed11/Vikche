import { AppError, getErrorMessage } from "@/lib/http-error";
import { normalizeDiscountCode } from "@/lib/discount-code";
import type { ResolvedSimpleProduct } from "@/lib/types";

type OpenAiExtraction = {
  title: string | null;
  productCode: string | null;
  price: number | null;
  originalPrice: number | null;
  discountCode: string | null;
  inStock: boolean | null;
  imageUrl: string | null;
  variantText: string | null;
};

type OpenAiResponsePayload = {
  error?: { message?: string };
  choices?: Array<{
    message?: {
      content?: unknown;
    };
  }>;
};

function getRequiredEnv(name: string) {
  const value = process.env[name]?.trim();

  if (!value) {
    throw new AppError(500, `Missing ${name} on the server.`);
  }

  return value;
}

function normalizeText(value: string | undefined | null) {
  return value?.replace(/\u00a0/g, " ").replace(/\s+/g, " ").trim() ?? "";
}

function normalizeImageUrl(value: string | null, baseUrl: string) {
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

function normalizeOldPrice(currentPrice: number, originalPrice: number | null) {
  if (originalPrice === null) {
    return null;
  }

  return originalPrice > currentPrice ? originalPrice : null;
}

function deriveProductCode(url: string) {
  const parsed = new URL(url);
  return `${parsed.hostname}${parsed.pathname}${parsed.search}`;
}

function clampText(value: string, maxLength: number) {
  return value.length > maxLength ? value.slice(0, maxLength) : value;
}

function stripNoisyMarkup(value: string) {
  return value
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<noscript[\s\S]*?<\/noscript>/gi, " ")
    .replace(/<template[\s\S]*?<\/template>/gi, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function extractKeywordSnippets(value: string, keywords: string[], windowSize = 260) {
  const normalized = value.toLowerCase();
  const snippets: string[] = [];

  for (const keyword of keywords) {
    const index = normalized.indexOf(keyword.toLowerCase());

    if (index < 0) {
      continue;
    }

    const snippet = value
      .slice(Math.max(0, index - windowSize), index + windowSize)
      .replace(/\s+/g, " ")
      .trim();

    if (snippet && !snippets.includes(snippet)) {
      snippets.push(snippet);
    }
  }

  return snippets;
}

function extractSymbolSnippets(value: string, symbols: string[], windowSize = 220) {
  const snippets: string[] = [];

  for (const symbol of symbols) {
    let index = value.indexOf(symbol);

    while (index >= 0) {
      const snippet = value
        .slice(Math.max(0, index - windowSize), index + windowSize)
        .replace(/\s+/g, " ")
        .trim();

      if (snippet && !snippets.includes(snippet)) {
        snippets.push(snippet);
      }

      if (snippets.length >= 6) {
        return snippets;
      }

      index = value.indexOf(symbol, index + symbol.length);
    }
  }

  return snippets;
}

function parseContent(content: unknown) {
  if (typeof content === "string") {
    return content;
  }

  if (Array.isArray(content)) {
    const textParts = content
      .map((item) =>
        item && typeof item === "object" && "type" in item && item.type === "text"
          ? String((item as { text?: unknown }).text ?? "")
          : "",
      )
      .filter(Boolean);

    return textParts.join("");
  }

  return "";
}

async function runExtractionRequest(params: {
  apiKey: string;
  model: string;
  canonicalUrl: string;
  title: string;
  textSnippet: string;
  htmlSnippet: string;
  signalSnippets: string[];
  promoSnippets: string[];
}) {
  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${params.apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: params.model,
      temperature: 0,
      response_format: {
        type: "json_object",
      },
      messages: [
        {
          role: "system",
          content:
            "You extract product data from ecommerce pages. Return JSON only. Prefer the main selected product on the page, not related products. Extract only EUR prices. If both EUR and another currency appear, always use the EUR amounts. If a field is unknown, return null. availability must be true, false, or null. discountCode must be the explicit coupon or promo code token shown on the page, not marketing text. If the page says phrases like 'с код SALE', 'with code SALE', 'use code SALE', or similar, extract only the token SALE. Never use SKU, shade code, or product code as discountCode. If no explicit code is shown, return null.",
        },
        {
          role: "user",
          content: [
            `URL: ${params.canonicalUrl}`,
            `Document title: ${params.title}`,
            "Return JSON with keys: title, productCode, price, originalPrice, discountCode, inStock, imageUrl, variantText.",
            "Focus on the selected product, the current EUR price, the old EUR price if shown, and the explicit promo code if one appears next to price or discount text.",
            "If a lower EUR price is shown inside a promo box together with an explicit code, use that lower EUR amount as price and the higher EUR amount as originalPrice when both are clearly shown.",
            params.signalSnippets.length > 0
              ? `High-signal snippets:\n${params.signalSnippets.join("\n---\n")}`
              : "High-signal snippets: none found",
            params.promoSnippets.length > 0
              ? `Promo-related snippets:\n${params.promoSnippets.join("\n---\n")}`
              : "Promo-related snippets: none found",
            "Visible text:",
            params.textSnippet,
            "HTML snippet without scripts/styles:",
            params.htmlSnippet,
          ].join("\n\n"),
        },
      ],
    }),
  });

  const payload = (await response.json()) as OpenAiResponsePayload;

  if (!response.ok) {
    throw new AppError(
      502,
      payload.error?.message || "OpenAI extraction failed.",
    );
  }

  const content = parseContent(payload.choices?.[0]?.message?.content);

  if (!content) {
    throw new AppError(502, "OpenAI extraction returned an empty response.");
  }

  try {
    return JSON.parse(content) as OpenAiExtraction;
  } catch (error) {
    throw new AppError(502, `OpenAI returned invalid JSON: ${getErrorMessage(error)}`);
  }
}

function modelsToTry() {
  const primaryModel = process.env.OPENAI_MODEL?.trim() || "gpt-5.4-mini";
  const fallbackModel = process.env.OPENAI_FALLBACK_MODEL?.trim();

  if (!fallbackModel || fallbackModel === primaryModel) {
    return [primaryModel];
  }

  return [primaryModel, fallbackModel];
}

export async function extractGenericProductWithOpenAI(params: {
  canonicalUrl: string;
  html: string;
  title: string;
  visibleText: string;
}): Promise<ResolvedSimpleProduct> {
  const apiKey = getRequiredEnv("OPENAI_API_KEY");
  const cleanedHtml = stripNoisyMarkup(params.html);
  const cleanedVisibleText = normalizeText(params.visibleText);
  const promoSnippets = extractKeywordSnippets(cleanedHtml, [
    "с код",
    "with code",
    "use code",
    "promo code",
    "coupon code",
    "discount code",
    "voucher",
    "актуална цена",
    "стара цена",
    "last lowest price",
    "old price",
  ]);
  const signalSnippets = [
    ...extractKeywordSnippets(cleanedVisibleText, [
      "с код",
      "with code",
      "use code",
      "в наличност",
      "out of stock",
      "изчерпан",
      "add to cart",
      "добави в кошницата",
    ], 220),
    ...extractSymbolSnippets(cleanedVisibleText, ["€", "лв"], 220),
    ...extractKeywordSnippets(cleanedHtml, [
      "с код",
      "with code",
      "use code",
      "в наличност",
      "out of stock",
      "изчерпан",
      "add to cart",
      "добави в кошницата",
      "актуална цена",
      "old price",
      "last lowest price",
    ], 220),
    ...extractSymbolSnippets(cleanedHtml, ["€", "лв"], 220),
  ].slice(0, 12);
  const htmlSnippet = clampText(cleanedHtml, 80_000);
  const textSnippet = clampText(cleanedVisibleText, 25_000);
  let extracted: OpenAiExtraction | null = null;
  let normalizedTitle = "";
  let price: number | null = null;
  let lastError: AppError | null = null;

  for (const model of modelsToTry()) {
    try {
      const currentExtraction = await runExtractionRequest({
        apiKey,
        model,
        canonicalUrl: params.canonicalUrl,
        title: params.title,
        textSnippet,
        htmlSnippet,
        signalSnippets,
        promoSnippets,
      });
      const currentTitle =
        normalizeText(currentExtraction.title) || normalizeText(params.title);
      const currentPrice =
        typeof currentExtraction.price === "number" && Number.isFinite(currentExtraction.price)
          ? currentExtraction.price
          : null;

      if (currentTitle && currentPrice !== null) {
        extracted = currentExtraction;
        normalizedTitle = currentTitle;
        price = currentPrice;
        break;
      }

      lastError = new AppError(422, "Не успяхме да разчетем този продуктов линк.");
    } catch (error) {
      lastError =
        error instanceof AppError
          ? error
          : new AppError(502, getErrorMessage(error));
    }
  }

  if (!extracted || price === null || !normalizedTitle) {
    throw lastError ?? new AppError(422, "Не успяхме да разчетем този продуктов линк.");
  }

  return {
    kind: "simple",
    retailer: new URL(params.canonicalUrl).hostname.replace(/^www\./, ""),
    canonicalUrl: params.canonicalUrl,
    productUrl: params.canonicalUrl,
    title: normalizedTitle,
    productCode: normalizeText(extracted.productCode) || deriveProductCode(params.canonicalUrl),
    masterProductCode: null,
    variantLabel: null,
    price,
    originalPrice: normalizeOldPrice(
      price,
      typeof extracted.originalPrice === "number" && Number.isFinite(extracted.originalPrice)
        ? extracted.originalPrice
        : null,
    ),
    discountCode: normalizeDiscountCode(extracted.discountCode),
    currency: "EUR",
    inStock:
      typeof extracted.inStock === "boolean" ? extracted.inStock : null,
    imageUrl: normalizeImageUrl(extracted.imageUrl, params.canonicalUrl),
    variantText: normalizeText(extracted.variantText) || null,
  };
}
