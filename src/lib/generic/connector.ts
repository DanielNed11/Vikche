import { BrowserFetchError, fetchPageWithFallbacks } from "@/lib/browser-fetch";
import { extractGenericProductWithOpenAI } from "@/lib/generic/openai";
import { buildGenericSnapshot } from "@/lib/generic/parser";
import { normalizeGenericUrl, supportsGenericUrl } from "@/lib/generic/url";
import { AppError, getErrorMessage } from "@/lib/http-error";
import { failLatestAttempt } from "@/lib/scrape-attempts";
import type {
  ResolveProductResult,
  ResolvedSimpleProduct,
  ScrapeAttemptDraft,
} from "@/lib/types";

class HtmlCaptureError extends AppError {
  constructor(
    status: number,
    message: string,
    public readonly html: string,
    public readonly attempts?: ScrapeAttemptDraft[],
  ) {
    super(status, message);
    this.name = "HtmlCaptureError";
  }
}

export class GenericScrapeError extends AppError {
  constructor(
    status: number,
    message: string,
    public readonly attempts: ScrapeAttemptDraft[],
  ) {
    super(status, message);
    this.name = "GenericScrapeError";
  }
}

async function scrapeWithPlaywright(rawUrl: string) {
  const {
    html,
    finalUrl,
    title,
    visibleText,
    transport,
    attempts,
  } = await fetchPageWithFallbacks(rawUrl);

  const normalizedTitle = title.toLowerCase();
  const normalizedVisibleText = visibleText.toLowerCase();

  if (
    normalizedTitle.includes("access denied") ||
    normalizedVisibleText.includes("we've noticed something unusual") ||
    normalizedVisibleText.includes("attention required") ||
    normalizedVisibleText.includes("temporarily blocked")
  ) {
    throw new HtmlCaptureError(
      502,
      "Този магазин временно блокира автоматичното зареждане на продукта.",
      html,
      failLatestAttempt(
        attempts,
        transport,
        "Този магазин временно блокира автоматичното зареждане на продукта.",
      ),
    );
  }

  try {
    return {
      html,
      finalUrl,
      transport,
      attempts,
      resolved: await extractGenericProductWithOpenAI({
        canonicalUrl: finalUrl,
        html,
        title,
        visibleText,
      }),
    };
  } catch (error) {
    const message = getErrorMessage(error);
    const status = error instanceof AppError ? error.status : 502;

    throw new HtmlCaptureError(
      status,
      message,
      html,
      failLatestAttempt(attempts, transport, message),
    );
  }
}

async function resolveGenericProductInternal(rawUrl: string) {
  const canonicalUrl = normalizeGenericUrl(rawUrl);

  try {
    const result = await scrapeWithPlaywright(canonicalUrl);

    return {
      resolved: result.resolved,
      extractor: result.transport,
      attempts: result.attempts,
    };
  } catch (error) {
    const message = getErrorMessage(error);
    const status = error instanceof AppError ? error.status : 502;
    const attempts =
      error instanceof BrowserFetchError
        ? error.attempts
          : error instanceof HtmlCaptureError && error.attempts
            ? error.attempts
          : ([{
              extractor: "playwright",
              ok: false,
              error: message,
            }] satisfies ScrapeAttemptDraft[]);

    throw new GenericScrapeError(status, message, attempts);
  }
}

export async function resolveGenericProduct(rawUrl: string): Promise<ResolveProductResult> {
  const result = await resolveGenericProductInternal(rawUrl);

  return {
    resolved: result.resolved,
  };
}

export async function scrapeGenericProduct(rawUrl: string) {
  const result = await resolveGenericProductInternal(rawUrl);
  const resolved = result.resolved as ResolvedSimpleProduct;

  return {
    snapshot: buildGenericSnapshot(resolved, result.extractor),
    attempts: result.attempts,
  };
}

export const genericConnector = {
  supports(url: string) {
    return supportsGenericUrl(url);
  },
  async fetchSnapshot(url: string) {
    const result = await scrapeGenericProduct(url);
    return result.snapshot;
  },
};
