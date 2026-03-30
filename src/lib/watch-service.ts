import {
  CurrencyCode,
  ExtractorKind as PrismaExtractorKind,
  NotificationChannel as PrismaNotificationChannel,
  NotificationStatus as PrismaNotificationStatus,
  Prisma,
  RetailerSlug,
  WatchStatus as PrismaWatchStatus,
} from "@prisma/client";

import {
  DouglasScrapeError,
  resolveDouglasProduct,
  scrapeDouglasProduct,
} from "@/lib/douglas/connector";
import { normalizeDouglasUrl } from "@/lib/douglas/url";
import { AppError, getErrorMessage } from "@/lib/http-error";
import { deliverNotification } from "@/lib/notifier";
import { prisma } from "@/lib/prisma";
import type {
  CreateWatchResult,
  DashboardData,
  DueCheckResult,
  ExtractorKind,
  NotificationChannel,
  NotificationRecord,
  NotificationStatus,
  PriceSnapshotRecord,
  ResolvedDouglasProduct,
  Retailer,
  ScrapeAttemptDraft,
  ScrapeAttemptRecord,
  WatchMutationResult,
  WatchRecord,
  WatchStatus,
  WatchView,
} from "@/lib/types";

const DUE_INTERVAL_MS = 24 * 60 * 60 * 1000;
const SCRAPE_ATTEMPT_LIMIT = 20;

const WATCH_VIEW_INCLUDE = Prisma.validator<Prisma.ProductWatchDefaultArgs>()({
  include: {
    storeProduct: {
      include: {
        retailer: true,
        priceSnapshots: {
          orderBy: {
            scrapedAt: "desc",
          },
          take: 6,
        },
        scrapeAttempts: {
          orderBy: {
            createdAt: "desc",
          },
          take: 6,
        },
      },
    },
    notifications: {
      include: {
        previousSnapshot: true,
        triggeringSnapshot: true,
      },
      orderBy: {
        createdAt: "desc",
      },
      take: 4,
    },
  },
});

const NOTIFICATION_INCLUDE = Prisma.validator<Prisma.NotificationDefaultArgs>()({
  include: {
    previousSnapshot: true,
    triggeringSnapshot: true,
    productWatch: {
      include: {
        user: true,
        storeProduct: {
          include: {
            retailer: true,
          },
        },
      },
    },
  },
});

type ProductWatchWithRelations = Prisma.ProductWatchGetPayload<typeof WATCH_VIEW_INCLUDE>;
type NotificationWithRelations = Prisma.NotificationGetPayload<typeof NOTIFICATION_INCLUDE>;

function isDue(lastCheckedAt: string | null, now = Date.now()) {
  if (!lastCheckedAt) {
    return true;
  }

  return now - new Date(lastCheckedAt).getTime() >= DUE_INTERVAL_MS;
}

function toNullableNumber(value: Prisma.Decimal | null | undefined) {
  if (value === null || value === undefined) {
    return null;
  }

  return value.toNumber();
}

function toNumber(value: Prisma.Decimal) {
  return value.toNumber();
}

function mapRetailer(slug: RetailerSlug): Retailer {
  return slug.toLowerCase() as Retailer;
}

function mapExtractor(value: PrismaExtractorKind | null): ExtractorKind | null {
  if (!value) {
    return null;
  }

  return value.toLowerCase() as ExtractorKind;
}

function mapExtractorToPrisma(value: ExtractorKind): PrismaExtractorKind {
  return value === "http"
    ? PrismaExtractorKind.HTTP
    : PrismaExtractorKind.PLAYWRIGHT;
}

function mapWatchStatus(value: PrismaWatchStatus): WatchStatus {
  return value.toLowerCase() as WatchStatus;
}

function mapWatchStatusToPrisma(value: WatchStatus): PrismaWatchStatus {
  switch (value) {
    case "pending":
      return PrismaWatchStatus.PENDING;
    case "ok":
      return PrismaWatchStatus.OK;
    case "error":
      return PrismaWatchStatus.ERROR;
  }
}

function mapNotificationChannel(
  value: PrismaNotificationChannel,
): NotificationChannel {
  return value.toLowerCase() as NotificationChannel;
}

function mapNotificationChannelToPrisma(
  value: NotificationChannel,
): PrismaNotificationChannel {
  return value === "email"
    ? PrismaNotificationChannel.EMAIL
    : PrismaNotificationChannel.LOG;
}

function mapNotificationStatus(
  value: PrismaNotificationStatus,
): NotificationStatus {
  return value.toLowerCase() as NotificationStatus;
}

function mapNotificationStatusToPrisma(
  value: NotificationStatus,
): PrismaNotificationStatus {
  switch (value) {
    case "queued":
      return PrismaNotificationStatus.QUEUED;
    case "sent":
      return PrismaNotificationStatus.SENT;
    case "logged":
      return PrismaNotificationStatus.LOGGED;
    case "failed":
      return PrismaNotificationStatus.FAILED;
  }
}

function formatNotificationSubject(
  title: string | null,
  productCode: string | null,
) {
  return `Vikche: намаление за ${title ?? productCode ?? "Продукт"}`;
}

function buildNotificationMessage(
  status: NotificationStatus,
  previousPrice: number,
  currentPrice: number,
  deliveryError: string | null,
) {
  if (status === "failed" && deliveryError) {
    return `Известието не беше изпратено: ${deliveryError}`;
  }

  if (status === "sent") {
    return `Имейл известието е изпратено. Цената падна от ${previousPrice.toFixed(2)} на ${currentPrice.toFixed(2)} EUR.`;
  }

  if (status === "logged") {
    return `Намалението е записано. Цената падна от ${previousPrice.toFixed(2)} на ${currentPrice.toFixed(2)} EUR.`;
  }

  return `Цената падна от ${previousPrice.toFixed(2)} на ${currentPrice.toFixed(2)} EUR.`;
}

function buildNotificationRecord(
  notification: Pick<
    NotificationWithRelations,
    | "id"
    | "productWatchId"
    | "channel"
    | "status"
    | "deliveryError"
    | "createdAt"
    | "deliveredAt"
    | "previousSnapshot"
    | "triggeringSnapshot"
  >,
  context: {
    title: string | null;
    productCode: string | null;
  },
): NotificationRecord {
  const previousPrice = toNumber(notification.previousSnapshot.price);
  const currentPrice = toNumber(notification.triggeringSnapshot.price);
  const status = mapNotificationStatus(notification.status);

  return {
    id: notification.id,
    watchId: notification.productWatchId,
    kind: "price_drop",
    channel: mapNotificationChannel(notification.channel),
    status,
    subject: formatNotificationSubject(context.title, context.productCode),
    message: buildNotificationMessage(
      status,
      previousPrice,
      currentPrice,
      notification.deliveryError,
    ),
    previousPrice,
    currentPrice,
    createdAt: notification.createdAt.toISOString(),
    deliveredAt: notification.deliveredAt?.toISOString() ?? null,
  };
}

function buildPriceSnapshotRecord(
  productId: string,
  snapshot: ProductWatchWithRelations["storeProduct"]["priceSnapshots"][number],
): PriceSnapshotRecord {
  return {
    id: snapshot.id,
    productId,
    price: toNumber(snapshot.price),
    originalPrice: toNullableNumber(snapshot.originalPrice),
    currency: "EUR",
    inStock: snapshot.inStock,
    extractor: mapExtractor(snapshot.extractor) ?? "http",
    scrapedAt: snapshot.scrapedAt.toISOString(),
  };
}

function buildScrapeAttemptRecord(
  productId: string,
  attempt: ProductWatchWithRelations["storeProduct"]["scrapeAttempts"][number],
): ScrapeAttemptRecord {
  return {
    id: attempt.id,
    productId,
    extractor: mapExtractor(attempt.extractor) ?? "http",
    ok: attempt.ok,
    error: attempt.error,
    createdAt: attempt.createdAt.toISOString(),
  };
}

function buildWatchView(watch: ProductWatchWithRelations): WatchView {
  const notifications = watch.notifications.map((notification) =>
    buildNotificationRecord(notification, {
      title: watch.storeProduct.title,
      productCode: watch.storeProduct.externalProductCode,
    }),
  );

  const watchRecord: WatchRecord = {
    id: watch.id,
    productId: watch.storeProductId,
    retailer: mapRetailer(watch.storeProduct.retailer.slug),
    canonicalUrl: watch.storeProduct.canonicalUrl,
    productUrl: watch.storeProduct.productUrl,
    title: watch.storeProduct.title,
    productCode: watch.storeProduct.externalProductCode,
    masterProductCode: watch.storeProduct.externalMasterProductCode,
    variantLabel: watch.storeProduct.variantLabel,
    currentPrice: toNullableNumber(watch.storeProduct.currentPrice),
    originalPrice: toNullableNumber(watch.storeProduct.originalPrice),
    currency: "EUR",
    inStock: watch.storeProduct.inStock,
    imageUrl: watch.storeProduct.imageUrl,
    variantText: watch.storeProduct.variantText,
    lastCheckedAt: watch.storeProduct.lastCheckedAt?.toISOString() ?? null,
    lastStatus: mapWatchStatus(watch.storeProduct.lastStatus),
    lastError: watch.storeProduct.lastError,
    lastExtractor: mapExtractor(watch.storeProduct.lastExtractor),
    lastNotificationAt: notifications[0]?.createdAt ?? null,
    createdAt: watch.createdAt.toISOString(),
    updatedAt: watch.updatedAt.toISOString(),
  };

  return {
    ...watchRecord,
    history: watch.storeProduct.priceSnapshots.map((snapshot) =>
      buildPriceSnapshotRecord(watch.storeProductId, snapshot),
    ),
    notifications,
    scrapeAttempts: watch.storeProduct.scrapeAttempts.map((attempt) =>
      buildScrapeAttemptRecord(watch.storeProductId, attempt),
    ),
  };
}

async function ensureDouglasRetailer() {
  return prisma.retailer.upsert({
    where: {
      slug: RetailerSlug.DOUGLAS,
    },
    update: {
      name: "Douglas",
      baseUrl: "https://douglas.bg",
      active: true,
    },
    create: {
      slug: RetailerSlug.DOUGLAS,
      name: "Douglas",
      baseUrl: "https://douglas.bg",
      active: true,
    },
  });
}

async function getWatchViewOrThrow(id: string, userId: string) {
  const watch = await prisma.productWatch.findFirst({
    where: {
      id,
      userId,
    },
    ...WATCH_VIEW_INCLUDE,
  });

  if (!watch) {
    throw new AppError(404, "Продуктът не е намерен.");
  }

  return buildWatchView(watch);
}

function buildSeedProduct(
  resolved: ResolvedDouglasProduct,
  variantCode?: string,
) {
  if (resolved.kind === "simple") {
    return {
      title: resolved.title,
      productCode: resolved.productCode,
      masterProductCode: resolved.masterProductCode,
      variantLabel: resolved.variantLabel,
      currentPrice: resolved.price,
      originalPrice: resolved.originalPrice,
      inStock: resolved.inStock,
      imageUrl: resolved.imageUrl,
      variantText: resolved.variantText,
    };
  }

  const variant = resolved.variants.find((entry) => entry.variantCode === variantCode);

  if (!variant) {
    throw new AppError(
      409,
      `Вариантът ${variantCode ?? ""} не беше открит на страницата на продукта.`,
    );
  }

  return {
    title: resolved.title,
    productCode: variant.variantCode,
    masterProductCode: resolved.masterProductCode,
    variantLabel: variant.variantLabel,
    currentPrice: variant.price,
    originalPrice: variant.originalPrice,
    inStock: variant.inStock,
    imageUrl: variant.imageUrl ?? resolved.imageUrl,
    variantText: variant.variantText,
  };
}

async function persistAttempts(storeProductId: string, attempts: ScrapeAttemptDraft[]) {
  if (attempts.length === 0) {
    return;
  }

  await prisma.$transaction(async (tx) => {
    await tx.scrapeAttempt.createMany({
      data: attempts.map((attempt) => ({
        storeProductId,
        extractor: mapExtractorToPrisma(attempt.extractor),
        ok: attempt.ok,
        error: attempt.error,
      })),
    });

    const staleAttempts = await tx.scrapeAttempt.findMany({
      where: {
        storeProductId,
      },
      orderBy: {
        createdAt: "desc",
      },
      skip: SCRAPE_ATTEMPT_LIMIT,
      select: {
        id: true,
      },
    });

    if (staleAttempts.length > 0) {
      await tx.scrapeAttempt.deleteMany({
        where: {
          id: {
            in: staleAttempts.map((attempt) => attempt.id),
          },
        },
      });
    }
  });
}

async function finalizeNotification(notificationId: string) {
  const notification = await prisma.notification.findUnique({
    where: {
      id: notificationId,
    },
    ...NOTIFICATION_INCLUDE,
  });

  if (!notification) {
    return;
  }

  const notificationRecord = buildNotificationRecord(notification, {
    title: notification.productWatch.storeProduct.title,
    productCode: notification.productWatch.storeProduct.externalProductCode,
  });
  const result = await deliverNotification(notificationRecord, {
    title: notification.productWatch.storeProduct.title,
    canonicalUrl: notification.productWatch.storeProduct.canonicalUrl,
    recipientEmail: notification.productWatch.user.email,
  });

  await prisma.$transaction([
    prisma.notification.update({
      where: {
        id: notificationId,
      },
      data: {
        channel: mapNotificationChannelToPrisma(result.channel),
        status: mapNotificationStatusToPrisma(result.status),
        deliveryError: result.deliveryError,
        deliveredAt: result.deliveredAt ? new Date(result.deliveredAt) : null,
      },
    }),
    prisma.productWatch.update({
      where: {
        id: notification.productWatchId,
      },
      data: {
        lastNotifiedSnapshotId: notification.triggeringSnapshotId,
      },
    }),
  ]);
}

async function refreshStoreProductInternal(storeProductId: string) {
  const storeProduct = await prisma.storeProduct.findUnique({
    where: {
      id: storeProductId,
    },
    include: {
      retailer: true,
      productWatches: {
        select: {
          id: true,
        },
      },
      priceSnapshots: {
        orderBy: {
          scrapedAt: "desc",
        },
        take: 1,
      },
    },
  });

  if (!storeProduct) {
    throw new AppError(404, "Продуктът не е намерен.");
  }

  if (storeProduct.retailer.slug !== RetailerSlug.DOUGLAS) {
    throw new AppError(400, "Този магазин още не се поддържа.");
  }

  try {
    const result = await scrapeDouglasProduct(
      storeProduct.canonicalUrl,
      storeProduct.externalProductCode,
    );
    await persistAttempts(storeProductId, result.attempts);

    const previousSnapshot = storeProduct.priceSnapshots[0] ?? null;
    const notificationIds: string[] = [];

    await prisma.$transaction(async (tx) => {
      const newSnapshot = await tx.priceSnapshot.create({
        data: {
          storeProductId,
          price: result.snapshot.price,
          originalPrice: result.snapshot.originalPrice,
          currency: CurrencyCode.EUR,
          inStock: result.snapshot.inStock,
          extractor: mapExtractorToPrisma(result.snapshot.extractor),
          scrapedAt: new Date(result.snapshot.scrapedAt),
        },
      });

      await tx.storeProduct.update({
        where: {
          id: storeProductId,
        },
        data: {
          canonicalUrl: result.snapshot.canonicalUrl,
          productUrl: result.snapshot.productUrl,
          title: result.snapshot.title,
          externalProductCode: result.snapshot.productCode,
          externalMasterProductCode: result.snapshot.masterProductCode,
          variantLabel: result.snapshot.variantLabel,
          currentPrice: result.snapshot.price,
          originalPrice: result.snapshot.originalPrice,
          currency: CurrencyCode.EUR,
          inStock: result.snapshot.inStock,
          imageUrl: result.snapshot.imageUrl,
          variantText: result.snapshot.variantText,
          lastCheckedAt: new Date(result.snapshot.scrapedAt),
          lastStatus: mapWatchStatusToPrisma("ok"),
          lastError: null,
          lastExtractor: mapExtractorToPrisma(result.snapshot.extractor),
        },
      });

      if (
        previousSnapshot &&
        result.snapshot.price < toNumber(previousSnapshot.price)
      ) {
        const productWatches = await tx.productWatch.findMany({
          where: {
            storeProductId,
          },
          select: {
            id: true,
          },
        });

        for (const productWatch of productWatches) {
          const notification = await tx.notification.create({
            data: {
              productWatchId: productWatch.id,
              previousSnapshotId: previousSnapshot.id,
              triggeringSnapshotId: newSnapshot.id,
            },
          });
          notificationIds.push(notification.id);
        }
      }
    });

    for (const notificationId of notificationIds) {
      await finalizeNotification(notificationId);
    }

    return {
      error: null,
    };
  } catch (error) {
    const attempts = error instanceof DouglasScrapeError ? error.attempts : [];
    await persistAttempts(storeProductId, attempts);

    await prisma.storeProduct.update({
      where: {
        id: storeProductId,
      },
      data: {
        lastCheckedAt: new Date(),
        lastStatus: mapWatchStatusToPrisma("error"),
        lastError: getErrorMessage(error),
      },
    });

    return {
      error: getErrorMessage(error),
    };
  }
}

async function refreshWatchInternal(id: string, userId: string): Promise<WatchMutationResult> {
  const watch = await prisma.productWatch.findFirst({
    where: {
      id,
      userId,
    },
    select: {
      storeProductId: true,
    },
  });

  if (!watch) {
    throw new AppError(404, "Продуктът не е намерен.");
  }

  const result = await refreshStoreProductInternal(watch.storeProductId);

  return {
    watch: await getWatchViewOrThrow(id, userId),
    error: result.error,
  };
}

export async function getDashboardData(userId: string): Promise<DashboardData> {
  const watches = await prisma.productWatch.findMany({
    where: {
      userId,
    },
    orderBy: {
      createdAt: "desc",
    },
    ...WATCH_VIEW_INCLUDE,
  });
  const watchViews = watches.map((watch) => buildWatchView(watch));
  const recentNotifications = await prisma.notification.findMany({
    where: {
      productWatch: {
        userId,
      },
    },
    orderBy: {
      createdAt: "desc",
    },
    take: 6,
    ...NOTIFICATION_INCLUDE,
  });
  const priceDropCount = await prisma.notification.count({
    where: {
      productWatch: {
        userId,
      },
    },
  });
  const now = Date.now();
  const lastRunAt =
    watchViews
      .map((watch) => watch.lastCheckedAt)
      .filter((value): value is string => value !== null)
      .sort((left, right) => right.localeCompare(left))[0] ?? null;

  return {
    watches: watchViews,
    stats: {
      watchCount: watchViews.length,
      inStockCount: watchViews.filter((watch) => watch.inStock).length,
      dueCount: watchViews.filter((watch) => isDue(watch.lastCheckedAt, now)).length,
      priceDropCount,
    },
    recentNotifications: recentNotifications.map((notification) =>
      buildNotificationRecord(notification, {
        title: notification.productWatch.storeProduct.title,
        productCode: notification.productWatch.storeProduct.externalProductCode,
      }),
    ),
    lastRunAt,
  };
}

export async function createWatch(
  userId: string,
  url: string,
  variantCode?: string,
): Promise<CreateWatchResult> {
  const retailer = await ensureDouglasRetailer();
  const canonicalUrl = normalizeDouglasUrl(url);
  const { resolved } = await resolveDouglasProduct(canonicalUrl);

  if (resolved.kind === "configurable" && !variantCode) {
    throw new AppError(400, "Избери нюанс, преди да запазиш продукта.");
  }

  const seedProduct = buildSeedProduct(resolved, variantCode);
  const storeProduct = await prisma.storeProduct.upsert({
    where: {
      retailerId_externalProductCode: {
        retailerId: retailer.id,
        externalProductCode: seedProduct.productCode,
      },
    },
    update: {
      canonicalUrl,
      productUrl: canonicalUrl,
      title: seedProduct.title,
      externalMasterProductCode: seedProduct.masterProductCode,
      variantLabel: seedProduct.variantLabel,
      currentPrice: seedProduct.currentPrice,
      originalPrice: seedProduct.originalPrice,
      currency: CurrencyCode.EUR,
      inStock: seedProduct.inStock,
      imageUrl: seedProduct.imageUrl,
      variantText: seedProduct.variantText,
    },
    create: {
      retailerId: retailer.id,
      canonicalUrl,
      productUrl: canonicalUrl,
      externalProductCode: seedProduct.productCode,
      externalMasterProductCode: seedProduct.masterProductCode,
      title: seedProduct.title,
      variantLabel: seedProduct.variantLabel,
      currentPrice: seedProduct.currentPrice,
      originalPrice: seedProduct.originalPrice,
      currency: CurrencyCode.EUR,
      inStock: seedProduct.inStock,
      imageUrl: seedProduct.imageUrl,
      variantText: seedProduct.variantText,
    },
  });

  const existingWatch = await prisma.productWatch.findUnique({
    where: {
      userId_storeProductId: {
        userId,
        storeProductId: storeProduct.id,
      },
    },
  });

  if (existingWatch) {
    return {
      watch: await getWatchViewOrThrow(existingWatch.id, userId),
      duplicate: true,
      error: null,
    };
  }

  const productWatch = await prisma.productWatch.create({
    data: {
      userId,
      storeProductId: storeProduct.id,
    },
  });
  const refreshed = await refreshStoreProductInternal(storeProduct.id);

  return {
    watch: await getWatchViewOrThrow(productWatch.id, userId),
    duplicate: false,
    error: refreshed.error,
  };
}

export async function refreshWatch(userId: string, id: string) {
  return refreshWatchInternal(id, userId);
}

export async function runDueChecks(): Promise<DueCheckResult> {
  const dueThreshold = new Date(Date.now() - DUE_INTERVAL_MS);
  const dueProducts = await prisma.storeProduct.findMany({
    where: {
      productWatches: {
        some: {},
      },
      OR: [
        {
          lastCheckedAt: null,
        },
        {
          lastCheckedAt: {
            lte: dueThreshold,
          },
        },
      ],
    },
    select: {
      id: true,
    },
  });

  let updated = 0;
  let failures = 0;

  for (const storeProduct of dueProducts) {
    const result = await refreshStoreProductInternal(storeProduct.id);

    if (result.error) {
      failures += 1;
    } else {
      updated += 1;
    }
  }

  return {
    checked: dueProducts.length,
    updated,
    failures,
  };
}
