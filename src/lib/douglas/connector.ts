import {
  buildDouglasSnapshot,
  resolveDouglasProductHtml,
} from "@/lib/douglas/parser";
import { normalizeDouglasUrl, supportsDouglasUrl } from "@/lib/douglas/url";
import { getErrorMessage } from "@/lib/http-error";
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
  ) {
    super(message);
    this.name = "HtmlCaptureError";
  }
}

export class DouglasScrapeError extends Error {
  constructor(
    message: string,
    public readonly attempts: ScrapeAttemptDraft[],
  ) {
    super(message);
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

async function scrapeWithHttp(canonicalUrl: string) {
  const response = await fetch(canonicalUrl, {
    headers: {
      "accept":
        "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
      "accept-language": "bg-BG,bg;q=0.9,en-US;q=0.8,en;q=0.7",
      "cache-control": "no-cache",
      "user-agent":
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/136.0.0.0 Safari/537.36",
    },
    cache: "no-store",
    redirect: "follow",
  });
  const html = await response.text();

  if (!response.ok) {
    throw new HtmlCaptureError(
      `Douglas HTTP request failed with ${response.status}.`,
      html,
    );
  }

  try {
    return {
      html,
      ...(await parseFetchedHtml(html, canonicalUrl)),
    };
  } catch (error) {
    throw new HtmlCaptureError(getErrorMessage(error), html);
  }
}

async function resolveDouglasProductInternal(rawUrl: string) {
  const canonicalUrl = normalizeDouglasUrl(rawUrl);
  const attempts: ScrapeAttemptDraft[] = [];

  try {
    const result = await scrapeWithHttp(canonicalUrl);
    attempts.push({
      extractor: "http",
      ok: true,
      error: null,
    });

    return {
      resolved: result.resolved,
      extractor: "http" as const,
      attempts,
    };
  } catch (error) {
    const message = getErrorMessage(error);

    attempts.push({
      extractor: "http",
      ok: false,
      error: message,
    });

    throw new DouglasScrapeError(
      "Douglas extraction failed in HTTP mode.",
      attempts,
    );
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
    throw new DouglasScrapeError(getErrorMessage(error), result.attempts);
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
