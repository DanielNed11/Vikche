import { tmpdir } from "node:os";
import { join } from "node:path";

import { load } from "cheerio";
import type { BrowserContext, Page } from "playwright";

import { AppError, getErrorMessage } from "@/lib/http-error";
import { failLatestAttempt } from "@/lib/scrape-attempts";
import type { ExtractorKind, ScrapeAttemptDraft } from "@/lib/types";

const DEFAULT_USER_AGENT =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/136.0.0.0 Safari/537.36";

const ACCEPT_COOKIE_TEXTS = [
  "accept",
  "accept all",
  "allow all",
  "allow cookies",
  "agree",
  "i agree",
  "got it",
  "ok",
  "okay",
  "приеми",
  "приемам",
  "съгласен",
  "разбирам",
  "разреши",
  "allow",
];

type BrowserRuntime = {
  contextPromise?: Promise<BrowserContext>;
  warmedOrigins: Set<string>;
};

type BrowserManager = {
  runtime: BrowserRuntime;
  cleanupRegistered: boolean;
};

type ZyteConfig = {
  key: string;
  domains: string[];
};

type BrowserTransport = Exclude<ExtractorKind, "http">;

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
  transport: BrowserTransport;
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

const browserManager =
  (
    globalThis as typeof globalThis & {
      __vikcheBrowserManager?: BrowserManager;
    }
  ).__vikcheBrowserManager ??
  {
    runtime: { warmedOrigins: new Set<string>() },
    cleanupRegistered: false,
  };

(
  globalThis as typeof globalThis & {
    __vikcheBrowserManager?: BrowserManager;
  }
).__vikcheBrowserManager = browserManager;

function profileDir() {
  return join(tmpdir(), "vikche-playwright-profile");
}

function readDomains(value: string | undefined) {
  return (value ?? "")
    .split(",")
    .map((entry) => entry.trim().toLowerCase())
    .filter(Boolean);
}

function readZyteConfig(): ZyteConfig | null {
  const key = process.env.ZYTE_API_KEY?.trim();

  if (!key) {
    return null;
  }

  return {
    key,
    domains: readDomains(
      process.env.ZYTE_DOMAINS || process.env.SCRAPFLY_DOMAINS,
    ),
  };
}

function matchesConfiguredDomains(
  hostname: string,
  config: { domains: string[] } | null,
) {
  if (!config) {
    return false;
  }

  if (config.domains.length === 0) {
    return true;
  }

  const normalizedHostname = hostname.toLowerCase();

  return config.domains.some((domain) => {
    const normalizedDomain = domain.replace(/^\*\./, "");
    return (
      normalizedHostname === normalizedDomain ||
      normalizedHostname.endsWith(`.${normalizedDomain}`)
    );
  });
}

function shouldUseZyteForHost(hostname: string, zyteConfig: ZyteConfig | null) {
  return matchesConfiguredDomains(hostname, zyteConfig);
}

async function closeBrowserContext() {
  const runtime = browserManager.runtime;
  const contextPromise = runtime.contextPromise;
  runtime.contextPromise = undefined;
  runtime.warmedOrigins.clear();

  if (!contextPromise) {
    return;
  }

  try {
    const context = await contextPromise;
    await context.close();
  } catch {
    // ignore cleanup failures
  }
}

async function closeAllBrowserContexts() {
  await closeBrowserContext();
}

function registerCleanupHooks() {
  if (browserManager.cleanupRegistered) {
    return;
  }

  browserManager.cleanupRegistered = true;

  process.once("SIGINT", () => {
    void closeAllBrowserContexts().finally(() => process.exit(130));
  });

  process.once("SIGTERM", () => {
    void closeAllBrowserContexts().finally(() => process.exit(143));
  });

  process.once("beforeExit", () => {
    void closeAllBrowserContexts();
  });
}

async function createContext() {
  const { chromium } = await import("playwright");

  const context = await chromium.launchPersistentContext(profileDir(), {
    headless: true,
    locale: "bg-BG",
    timezoneId: "Europe/Sofia",
    userAgent: DEFAULT_USER_AGENT,
    viewport: {
      width: 1440,
      height: 2200,
    },
    colorScheme: "light",
    extraHTTPHeaders: {
      "accept-language": "bg-BG,bg;q=0.9,en-US;q=0.8,en;q=0.7",
    },
  });

  await context.addInitScript(() => {
    Object.defineProperty(navigator, "webdriver", {
      get: () => undefined,
    });

    Object.defineProperty(navigator, "languages", {
      get: () => ["bg-BG", "bg", "en-US", "en"],
    });

    Object.defineProperty(navigator, "platform", {
      get: () => "MacIntel",
    });

    Object.defineProperty(navigator, "plugins", {
      get: () => [1, 2, 3, 4, 5],
    });
  });

  registerCleanupHooks();
  return context;
}

async function getBrowserContext() {
  const runtime = browserManager.runtime;

  if (!runtime.contextPromise) {
    runtime.contextPromise = createContext();
  }

  return runtime.contextPromise;
}

function warmupUrlFor(targetUrl: URL) {
  const [firstSegment] = targetUrl.pathname.split("/").filter(Boolean);

  if (firstSegment === "bg_bg") {
    return `${targetUrl.origin}/bg_bg/index.html`;
  }

  if (firstSegment && /^[a-z]{2}$/i.test(firstSegment)) {
    return `${targetUrl.origin}/${firstSegment}/`;
  }

  return `${targetUrl.origin}/`;
}

async function gentlySettlePage(page: Page) {
  await page.waitForTimeout(1_200);
  await page.waitForLoadState("networkidle", {
    timeout: 5_000,
  }).catch(() => undefined);

  await page.mouse.move(480, 240, {
    steps: 4,
  });
  await page.mouse.wheel(0, 320).catch(() => undefined);
  await page.waitForTimeout(300);
}

async function acceptCookieBanner(page: Page) {
  return page
    .evaluate((acceptedTexts) => {
      const clickableElements = Array.from(
        document.querySelectorAll<HTMLElement>(
          "button, [role='button'], input[type='button'], input[type='submit'], a",
        ),
      );

      for (const element of clickableElements) {
        const text = [
          element.innerText,
          element.textContent,
          element.getAttribute("aria-label"),
          element.getAttribute("title"),
          element.getAttribute("value"),
        ]
          .filter(Boolean)
          .join(" ")
          .trim()
          .toLowerCase();

        if (!text) {
          continue;
        }

        if (acceptedTexts.some((acceptedText) => text.includes(acceptedText))) {
          element.click();
          return true;
        }
      }

      return false;
    }, ACCEPT_COOKIE_TEXTS)
    .catch(() => false);
}

async function warmupOrigin(
  context: BrowserContext,
  runtime: BrowserRuntime,
  targetUrl: URL,
) {
  const origin = targetUrl.origin;

  if (runtime.warmedOrigins.has(origin)) {
    return;
  }

  const page = await context.newPage();

  try {
    await page.goto(warmupUrlFor(targetUrl), {
      waitUntil: "domcontentloaded",
      timeout: 45_000,
    });

    await gentlySettlePage(page);

    const acceptedCookies = await acceptCookieBanner(page);

    if (acceptedCookies) {
      await page.waitForTimeout(800);
      await page.waitForLoadState("networkidle", {
        timeout: 4_000,
      }).catch(() => undefined);
    }

    runtime.warmedOrigins.add(origin);
  } catch {
    // warmup is best-effort
  } finally {
    await page.close().catch(() => undefined);
  }
}

async function readPage(page: Page, status: number): Promise<PageCapture> {
  await gentlySettlePage(page);
  await acceptCookieBanner(page);
  await page.waitForTimeout(700);
  await page.waitForLoadState("networkidle", {
    timeout: 4_000,
  }).catch(() => undefined);

  const html = await page.content();
  const finalUrl = page.url();
  const title = await page.title();
  const visibleText = await page.locator("body").innerText().catch(() => "");

  return {
    status,
    finalUrl,
    html,
    title,
    visibleText,
  };
}

async function navigateAndCapture(
  context: BrowserContext,
  targetUrl: string,
): Promise<PageCapture> {
  const page = await context.newPage();

  try {
    const response = await page.goto(targetUrl, {
      waitUntil: "domcontentloaded",
      timeout: 45_000,
    });

    return await readPage(page, response?.status() ?? 200);
  } finally {
    await page.close().catch(() => undefined);
  }
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
  extractor: BrowserTransport,
  status: number,
): ScrapeAttemptDraft {
  return {
    extractor,
    ok: false,
    error: buildFetchError(status).message,
  };
}

function attemptForError(
  extractor: BrowserTransport,
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

async function captureWithMode(
  targetUrl: URL,
) {
  const context = await getBrowserContext();
  const runtime = browserManager.runtime;

  await warmupOrigin(context, runtime, targetUrl);

  let capture = await navigateAndCapture(context, targetUrl.toString());

  if (capture.status === 403 || capture.status === 429) {
    runtime.warmedOrigins.delete(targetUrl.origin);
    await warmupOrigin(context, runtime, targetUrl);
    capture = await navigateAndCapture(context, targetUrl.toString());
  }

  return capture;
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
  const browserHtml = typeof payload.browserHtml === "string" ? payload.browserHtml.trim() : "";

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

async function attemptPlaywrightCapture(targetUrl: URL) {
  const transport = "playwright" as const;

  try {
    const capture = await captureWithMode(targetUrl);

    return {
      capture: {
        ...capture,
        transport,
        attempts: [],
      },
      attempts:
        capture.status >= 400
          ? [attemptForStatus(transport, capture.status)]
          : [{ extractor: transport, ok: true, error: null } satisfies ScrapeAttemptDraft],
      error: null,
    };
  } catch (error) {
    return {
      capture: null,
      attempts: [attemptForError(transport, error)],
      error,
    };
  }
}

async function attemptZyteCapture(
  targetUrl: URL,
  zyteConfig: ZyteConfig,
) {
  try {
    const result = await captureWithZyte(targetUrl, zyteConfig);

    return {
      capture: {
        ...result,
        transport: "zyte" as const,
        attempts: [],
      },
      attempts:
        result.status >= 400
          ? [attemptForStatus("zyte", result.status)]
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

    const directAttempt = await attemptPlaywrightCapture(targetUrl);
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
        "playwright",
        "Този магазин временно блокира автоматичното зареждане на продукта.",
      );
    }

    const shouldRetryAfterDirect =
      directAttempt.capture === null ||
      directAttempt.capture.status === 403 ||
      directAttempt.capture.status === 429 ||
      directCaptureLooksBlocked;

    if (
      shouldRetryAfterDirect &&
      shouldUseZyteForHost(targetUrl.hostname, zyteConfig)
    ) {
      const zyteAttempt = await attemptZyteCapture(
        targetUrl,
        zyteConfig as ZyteConfig,
      );
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
