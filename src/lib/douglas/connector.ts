import {
  buildDouglasSnapshot,
  resolveDouglasProductHtml,
} from "@/lib/douglas/parser";
import { BrowserFetchError, fetchPageWithFallbacks } from "@/lib/browser-fetch";
import { normalizeDouglasUrl, supportsDouglasUrl } from "@/lib/douglas/url";
import { AppError, getErrorMessage } from "@/lib/http-error";
import { failLatestAttempt } from "@/lib/scrape-attempts";
import type {
  ResolveDouglasResult,
  ResolvedDouglasProduct,
  ScrapeAttemptDraft,
} from "@/lib/types";

interface ExtractorSuccess {
  resolved: ResolvedDouglasProduct;
}

class HtmlCaptureError extends Error {
  constructor(
    message: string,
    public readonly html: string,
    public readonly attempts?: ScrapeAttemptDraft[],
  ) {
    super(message);
    this.name = "HtmlCaptureError";
  }
}

export class DouglasScrapeError extends AppError {
  constructor(
    status: number,
    message: string,
    public readonly attempts: ScrapeAttemptDraft[],
  ) {
    super(status, message);
    this.name = "DouglasScrapeError";
  }
}

async function parseFetchedHtml(
  html: string,
  canonicalUrl: string,
): Promise<ExtractorSuccess> {
  return {
    resolved: resolveDouglasProductHtml(html, canonicalUrl),
  };
}

async function scrapeWithPlaywright(canonicalUrl: string) {
  const { html, transport, attempts } = await fetchPageWithFallbacks(canonicalUrl);

  try {
    return {
      html,
      transport,
      attempts,
      ...(await parseFetchedHtml(html, canonicalUrl)),
    };
  } catch (error) {
    throw new HtmlCaptureError(
      getErrorMessage(error),
      html,
      failLatestAttempt(attempts, transport, getErrorMessage(error)),
    );
  }
}

async function resolveDouglasProductInternal(rawUrl: string) {
  const canonicalUrl = normalizeDouglasUrl(rawUrl);

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

    throw new DouglasScrapeError(status, message, attempts);
  }
}

export async function resolveDouglasProduct(rawUrl: string): Promise<ResolveDouglasResult> {
  const result = await resolveDouglasProductInternal(rawUrl);

  return {
    resolved: result.resolved,
  };
}

export async function scrapeDouglasProduct(rawUrl: string, variantCode?: string) {
  const result = await resolveDouglasProductInternal(rawUrl);

  try {
    return {
      snapshot: buildDouglasSnapshot(result.resolved, result.extractor, variantCode),
      attempts: result.attempts,
    };
  } catch (error) {
    const status = error instanceof AppError ? error.status : 502;
    throw new DouglasScrapeError(status, getErrorMessage(error), result.attempts);
  }
}

export const douglasConnector = {
  supports(url: string) {
    return supportsDouglasUrl(url);
  },
  async fetchSnapshot(url: string, variantCode?: string) {
    const result = await scrapeDouglasProduct(url, variantCode);
    return result.snapshot;
  },
};
