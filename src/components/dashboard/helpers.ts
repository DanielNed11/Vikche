import type { NotificationRecord, WatchView } from "@/lib/types";

export function formatPrice(price: number | null) {
  if (price === null) {
    return "Все още няма цена";
  }

  return new Intl.NumberFormat("bg-BG", {
    style: "currency",
    currency: "EUR",
  }).format(price);
}

export function formatDate(date: string | null) {
  if (!date) {
    return "Още не е проверяван";
  }

  return new Intl.DateTimeFormat("bg-BG", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Europe/Sofia",
  }).format(new Date(date));
}

export function statusTone(watch: WatchView) {
  if (watch.lastStatus === "error") {
    return "bg-danger/10 text-danger";
  }

  if (watch.inStock === false) {
    return "bg-warning/10 text-warning";
  }

  if (watch.lastStatus === "pending") {
    return "bg-accent/8 text-accent-strong";
  }

  return "bg-accent-soft text-accent-strong";
}

export function statusLabel(watch: WatchView) {
  if (watch.lastStatus === "error") {
    return "Ще опитаме отново";
  }

  if (watch.lastStatus === "pending") {
    return "Проверяваме";
  }

  if (watch.inStock === false) {
    return "Няма наличност";
  }

  return "Следим цената";
}

export function statusMessage(watch: WatchView) {
  if (watch.lastStatus === "error") {
    return "Последната проверка не успя, но Vikche ще опита отново автоматично.";
  }

  if (watch.inStock === false) {
    return "Продуктът в момента не е наличен в Douglas.";
  }

  return "Ще видиш нова цена тук веднага щом Douglas я промени.";
}

export function latestNotificationFor(
  notifications: NotificationRecord[],
): NotificationRecord | null {
  return notifications.reduce<NotificationRecord | null>((latest, current) => {
    if (!latest) {
      return current;
    }

    return new Date(current.createdAt).getTime() >
      new Date(latest.createdAt).getTime()
      ? current
      : latest;
  }, null);
}

export type WatchGroup = {
  key: string;
  title: string | null;
  canonicalUrl: string;
  imageUrl: string | null;
  watches: WatchView[];
  lowestPrice: number | null;
  latestNotification: NotificationRecord | null;
  inStockCount: number;
};

function compareVariantWatches(left: WatchView, right: WatchView) {
  const leftLabel = left.variantLabel ?? left.productCode ?? "";
  const rightLabel = right.variantLabel ?? right.productCode ?? "";

  return leftLabel.localeCompare(rightLabel, "bg", {
    numeric: true,
    sensitivity: "base",
  });
}

export function buildWatchGroups(watches: WatchView[]) {
  const groups = new Map<string, WatchGroup>();

  for (const watch of watches) {
    const key = watch.masterProductCode ?? watch.canonicalUrl;
    const existing = groups.get(key);

    if (!existing) {
      groups.set(key, {
        key,
        title: watch.title,
        canonicalUrl: watch.canonicalUrl,
        imageUrl: watch.imageUrl,
        watches: [watch],
        lowestPrice: watch.currentPrice,
        latestNotification: latestNotificationFor(watch.notifications),
        inStockCount: watch.inStock ? 1 : 0,
      });
      continue;
    }

    existing.watches.push(watch);
    existing.imageUrl ||= watch.imageUrl;
    existing.title ||= watch.title;
    existing.inStockCount += watch.inStock ? 1 : 0;

    if (
      watch.currentPrice !== null &&
      (existing.lowestPrice === null || watch.currentPrice < existing.lowestPrice)
    ) {
      existing.lowestPrice = watch.currentPrice;
    }

    const watchLatestNotification = latestNotificationFor(watch.notifications);
    if (
      watchLatestNotification &&
      (!existing.latestNotification ||
        new Date(watchLatestNotification.createdAt).getTime() >
          new Date(existing.latestNotification.createdAt).getTime())
    ) {
      existing.latestNotification = watchLatestNotification;
    }
  }

  return Array.from(groups.values()).map((group) => ({
    ...group,
    watches: [...group.watches].sort(compareVariantWatches),
  }));
}

export function variantLabelFor(watch: WatchView) {
  return watch.variantLabel ?? watch.variantText ?? watch.productCode ?? "Основен вариант";
}

export function variantMetaFor(watch: WatchView) {
  const parts = [`Код ${watch.productCode ?? "Неизвестен"}`];

  if (watch.variantText) {
    parts.push(watch.variantText);
  }

  return parts.join(" · ");
}

export function variantCountLabel(count: number) {
  return count === 1 ? "1 вариант" : `${count} варианта`;
}
