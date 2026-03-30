export type Retailer = "douglas";
export type ExtractorKind = "http" | "playwright";
export type WatchStatus = "pending" | "ok" | "error";
export type NotificationChannel = "email" | "log";
export type NotificationStatus = "queued" | "sent" | "logged" | "failed";

export interface WatchRecord {
  id: string;
  productId: string;
  retailer: Retailer;
  canonicalUrl: string;
  productUrl: string;
  title: string | null;
  productCode: string | null;
  masterProductCode: string | null;
  variantLabel: string | null;
  currentPrice: number | null;
  originalPrice: number | null;
  currency: "EUR";
  inStock: boolean | null;
  imageUrl: string | null;
  variantText: string | null;
  lastCheckedAt: string | null;
  lastStatus: WatchStatus;
  lastError: string | null;
  lastExtractor: ExtractorKind | null;
  lastNotificationAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface PriceSnapshotRecord {
  id: string;
  productId: string;
  price: number;
  originalPrice: number | null;
  currency: "EUR";
  inStock: boolean;
  extractor: ExtractorKind;
  scrapedAt: string;
}

export interface ScrapeAttemptRecord {
  id: string;
  productId: string;
  extractor: ExtractorKind;
  ok: boolean;
  error: string | null;
  createdAt: string;
}

export interface NotificationRecord {
  id: string;
  watchId: string;
  kind: "price_drop";
  channel: NotificationChannel;
  status: NotificationStatus;
  subject: string;
  message: string;
  currentPrice: number;
  previousPrice: number;
  createdAt: string;
  deliveredAt: string | null;
}

export interface ScrapedProductSnapshot {
  retailer: Retailer;
  canonicalUrl: string;
  productUrl: string;
  title: string;
  productCode: string;
  masterProductCode: string | null;
  variantLabel: string | null;
  price: number;
  originalPrice: number | null;
  currency: "EUR";
  inStock: boolean;
  imageUrl: string | null;
  variantText: string | null;
  extractor: ExtractorKind;
  scrapedAt: string;
}

export interface ResolvedVariantChoice {
  variantCode: string;
  variantLabel: string | null;
  variantText: string | null;
  price: number;
  originalPrice: number | null;
  currency: "EUR";
  inStock: boolean;
  imageUrl: string | null;
}

export interface ResolvedSimpleProduct {
  kind: "simple";
  retailer: Retailer;
  canonicalUrl: string;
  productUrl: string;
  title: string;
  productCode: string;
  masterProductCode: null;
  variantLabel: null;
  price: number;
  originalPrice: number | null;
  currency: "EUR";
  inStock: boolean;
  imageUrl: string | null;
  variantText: string | null;
}

export interface ResolvedConfigurableProduct {
  kind: "configurable";
  retailer: Retailer;
  canonicalUrl: string;
  productUrl: string;
  title: string;
  masterProductCode: string;
  imageUrl: string | null;
  defaultVariantCode: string | null;
  variants: ResolvedVariantChoice[];
}

export type ResolvedDouglasProduct =
  | ResolvedSimpleProduct
  | ResolvedConfigurableProduct;

export interface ResolveDouglasResult {
  resolved: ResolvedDouglasProduct;
}

export interface ScrapeAttemptDraft {
  extractor: ExtractorKind;
  ok: boolean;
  error: string | null;
}

export interface WatchView extends WatchRecord {
  history: PriceSnapshotRecord[];
  notifications: NotificationRecord[];
  scrapeAttempts: ScrapeAttemptRecord[];
}

export interface DashboardData {
  watches: WatchView[];
  stats: {
    watchCount: number;
    inStockCount: number;
    dueCount: number;
    priceDropCount: number;
  };
  recentNotifications: NotificationRecord[];
  lastRunAt: string | null;
}

export interface WatchMutationResult {
  watch: WatchView;
  error: string | null;
}

export interface CreateWatchResult extends WatchMutationResult {
  duplicate: boolean;
}

export interface DueCheckResult {
  checked: number;
  updated: number;
  failures: number;
}
