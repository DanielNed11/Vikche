import { load } from "cheerio";

import { AppError, getErrorMessage } from "@/lib/http-error";
import { failLatestAttempt } from "@/lib/scrape-attempts";
import type { ExtractorKind, ScrapeAttemptDraft } from "@/lib/types";

const DEFAULT_USER_AGENT =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/136.0.0.0 Safari/537.36";

type ZyteConfig = {
  key: string;
};

type FetchTransport = ExtractorKind;

export class BrowserFetchError extends AppError {
  constructor(
    status: number,
    message: string,
    public readonly attempts: ScrapeAttemptDraft[],
  ) {
    super(status, message);
    this.name = "BrowserFetchError";
  }
}

export type BrowserFetchResult = {
  finalUrl: string;
  html: string;
  title: string;
  visibleText: string;
  transport: FetchTransport;
  attempts: ScrapeAttemptDraft[];
};

type PageCapture = {
  finalUrl: string;
  html: string;
  title: string;
  visibleText: string;
  status: number;
};

type ZyteHtmlResponse = {
  url?: string;
  statusCode?: number;
  browserHtml?: string | null;
};

function readZyteConfig(): ZyteConfig | null {
  const key = process.env.ZYTE_API_KEY?.trim();

  if (!key) {
    return null;
  }

  return {
    key,
  };
}

function extractTitleAndVisibleText(html: string) {
  const $ = load(html);
  $("script, style, noscript, template").remove();

  const title =
    $("title").first().text().replace(/\s+/g, " ").trim() ||
    $("h1").first().text().replace(/\s+/g, " ").trim();
  const visibleText = $("body").text().replace(/\s+/g, " ").trim();

  return {
    title,
    visibleText,
  };
}

function buildFetchError(status: number) {
  const message =
    status === 403 || status === 429
      ? "Този магазин временно блокира автоматичното зареждане на продукта."
      : status === 404
        ? "Този продуктов линк не е наличен."
        : `Не успяхме да отворим този продуктов линк (${status}).`;

  return new AppError(status === 404 ? 404 : 502, message);
}

function attemptForStatus(
  extractor: FetchTransport,
  status: number,
): ScrapeAttemptDraft {
  return {
    extractor,
    ok: false,
    error: buildFetchError(status).message,
  };
}

function attemptForError(
  extractor: FetchTransport,
  error: unknown,
): ScrapeAttemptDraft {
  return {
    extractor,
    ok: false,
    error: getErrorMessage(error),
  };
}

function captureLooksBlocked(capture: PageCapture) {
  const normalizedTitle = capture.title.toLowerCase();
  const normalizedVisibleText = capture.visibleText.toLowerCase();

  return (
    normalizedTitle.includes("access denied") ||
    normalizedTitle.includes("attention required") ||
    normalizedTitle.includes("one moment") ||
    normalizedTitle.includes("just a moment") ||
    normalizedVisibleText.includes("we've noticed something unusual") ||
    normalizedVisibleText.includes("temporarily blocked") ||
    normalizedVisibleText.includes("attention required") ||
    normalizedVisibleText.includes("access denied") ||
    normalizedVisibleText.includes("verify you are human") ||
    normalizedVisibleText.includes("automated activity")
  );
}

async function captureWithHttp(targetUrl: URL): Promise<PageCapture> {
  const response = await fetch(targetUrl.toString(), {
    headers: {
      "user-agent": DEFAULT_USER_AGENT,
      "accept-language": "bg-BG,bg;q=0.9,en-US;q=0.8,en;q=0.7",
      accept:
        "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
    },
    redirect: "follow",
    cache: "no-store",
  });

  const html = await response.text();
  const extracted = extractTitleAndVisibleText(html);

  return {
    status: response.status,
    finalUrl: response.url || targetUrl.toString(),
    html,
    title: extracted.title,
    visibleText: extracted.visibleText,
  };
}

async function captureWithZyte(
  targetUrl: URL,
  zyteConfig: ZyteConfig,
): Promise<PageCapture> {
  const response = await fetch("https://api.zyte.com/v1/extract", {
    method: "POST",
    headers: {
      authorization: `Basic ${Buffer.from(`${zyteConfig.key}:`).toString("base64")}`,
      "content-type": "application/json",
      accept: "application/json",
    },
    cache: "no-store",
    body: JSON.stringify({
      url: targetUrl.toString(),
      browserHtml: true,
    }),
  });

  if (!response.ok) {
    throw new AppError(
      502,
      `Zyte върна неуспешен отговор (${response.status}).`,
    );
  }

  const payload = (await response.json()) as ZyteHtmlResponse;
  const browserHtml =
    typeof payload.browserHtml === "string" ? payload.browserHtml.trim() : "";

  if (!browserHtml) {
    throw new AppError(502, "Zyte не върна HTML съдържание.");
  }

  const extracted = extractTitleAndVisibleText(browserHtml);

  return {
    status: payload.statusCode ?? 200,
    finalUrl: payload.url ?? targetUrl.toString(),
    html: browserHtml,
    title: extracted.title,
    visibleText: extracted.visibleText,
  };
}

async function attemptHttpCapture(targetUrl: URL) {
  try {
    const capture = await captureWithHttp(targetUrl);

    return {
      capture: {
        ...capture,
        transport: "http" as const,
        attempts: [],
      },
      attempts:
        capture.status >= 400
          ? [attemptForStatus("http", capture.status)]
          : [{ extractor: "http", ok: true, error: null } satisfies ScrapeAttemptDraft],
      error: null,
    };
  } catch (error) {
    return {
      capture: null,
      attempts: [attemptForError("http", error)],
      error,
    };
  }
}

async function attemptZyteCapture(targetUrl: URL, zyteConfig: ZyteConfig) {
  try {
    const capture = await captureWithZyte(targetUrl, zyteConfig);

    return {
      capture: {
        ...capture,
        transport: "zyte" as const,
        attempts: [],
      },
      attempts:
        capture.status >= 400
          ? [attemptForStatus("zyte", capture.status)]
          : [{ extractor: "zyte", ok: true, error: null } satisfies ScrapeAttemptDraft],
      error: null,
    };
  } catch (error) {
    return {
      capture: null,
      attempts: [attemptForError("zyte", error)],
      error,
    };
  }
}

export async function fetchPageWithFallbacks(url: string): Promise<BrowserFetchResult> {
  try {
    const targetUrl = new URL(url);
    const zyteConfig = readZyteConfig();
    let attempts: ScrapeAttemptDraft[] = [];

    const directAttempt = await attemptHttpCapture(targetUrl);
    attempts.push(...directAttempt.attempts);

    const directCaptureLooksBlocked =
      directAttempt.capture !== null && captureLooksBlocked(directAttempt.capture);

    if (
      directAttempt.capture &&
      directAttempt.capture.status < 400 &&
      !directCaptureLooksBlocked
    ) {
      return {
        ...directAttempt.capture,
        attempts,
      };
    }

    if (directCaptureLooksBlocked) {
      attempts = failLatestAttempt(
        attempts,
        "http",
        "Този магазин временно блокира автоматичното зареждане на продукта.",
      );
    }

    const shouldRetryWithZyte =
      zyteConfig &&
      (directAttempt.capture === null ||
        directAttempt.capture.status === 403 ||
        directAttempt.capture.status === 429 ||
        directCaptureLooksBlocked);

    if (shouldRetryWithZyte) {
      const zyteAttempt = await attemptZyteCapture(targetUrl, zyteConfig);
      attempts.push(...zyteAttempt.attempts);

      if (zyteAttempt.capture && zyteAttempt.capture.status < 400) {
        return {
          ...zyteAttempt.capture,
          attempts,
        };
      }

      if (zyteAttempt.capture && zyteAttempt.capture.status >= 400) {
        const error = buildFetchError(zyteAttempt.capture.status);
        throw new BrowserFetchError(error.status, error.message, attempts);
      }

      if (zyteAttempt.error instanceof AppError) {
        throw new BrowserFetchError(
          zyteAttempt.error.status,
          zyteAttempt.error.message,
          attempts,
        );
      }
    }

    if (directAttempt.capture && directAttempt.capture.status >= 400) {
      const error = buildFetchError(directAttempt.capture.status);
      throw new BrowserFetchError(error.status, error.message, attempts);
    }

    if (directCaptureLooksBlocked) {
      throw new BrowserFetchError(
        502,
        "Този магазин временно блокира автоматичното зареждане на продукта.",
        attempts,
      );
    }

    if (directAttempt.error instanceof AppError) {
      throw new BrowserFetchError(
        directAttempt.error.status,
        directAttempt.error.message,
        attempts,
      );
    }

    throw new BrowserFetchError(
      502,
      getErrorMessage(
        directAttempt.error ?? new Error("Не успяхме да отворим този продуктов линк."),
      ),
      attempts,
    );
  } catch (error) {
    if (error instanceof AppError) {
      throw error;
    }

    throw new AppError(502, getErrorMessage(error));
  }
}
