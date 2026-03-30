"use client";

import Image from "next/image";
import { signOut } from "next-auth/react";
import { useState, useTransition } from "react";

import type {
  CreateWatchResult,
  DashboardData,
  NotificationRecord,
  ResolveDouglasResult,
  ResolvedConfigurableProduct,
  WatchMutationResult,
  WatchView,
} from "@/lib/types";

function formatPrice(price: number | null) {
  if (price === null) {
    return "Все още няма цена";
  }

  return new Intl.NumberFormat("bg-BG", {
    style: "currency",
    currency: "EUR",
  }).format(price);
}

function formatDate(date: string | null) {
  if (!date) {
    return "Още не е проверяван";
  }

  return new Intl.DateTimeFormat("bg-BG", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Europe/Sofia",
  }).format(new Date(date));
}

function statusTone(watch: WatchView) {
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

function statusLabel(watch: WatchView) {
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

function statusMessage(watch: WatchView) {
  if (watch.lastStatus === "error") {
    return "Последната проверка не успя, но Vikche ще опита отново автоматично.";
  }

  if (watch.inStock === false) {
    return "Продуктът в момента не е наличен в Douglas.";
  }

  return "Ще видиш нова цена тук веднага щом Douglas я промени.";
}

function latestNotificationFor(
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

type WatchGroup = {
  key: string;
  title: string | null;
  canonicalUrl: string;
  imageUrl: string | null;
  masterProductCode: string | null;
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

function buildWatchGroups(watches: WatchView[]) {
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
        masterProductCode: watch.masterProductCode,
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

function variantLabelFor(watch: WatchView) {
  return watch.variantLabel ?? watch.variantText ?? watch.productCode ?? "Основен вариант";
}

function variantMetaFor(watch: WatchView) {
  const parts = [`Код ${watch.productCode ?? "Неизвестен"}`];

  if (watch.variantText) {
    parts.push(watch.variantText);
  }

  return parts.join(" · ");
}

function variantCountLabel(count: number) {
  return count === 1 ? "1 вариант" : `${count} варианта`;
}

export function VikcheDashboard({
  initialData,
  viewer,
}: {
  initialData: DashboardData;
  viewer: {
    name: string | null;
    email: string | null;
    authEnabled: boolean;
  };
}) {
  const [dashboard, setDashboard] = useState(initialData);
  const [url, setUrl] = useState("");
  const [feedback, setFeedback] = useState<string | null>(null);
  const [expandedGroups, setExpandedGroups] = useState<Record<string, boolean>>({});
  const [pendingSelection, setPendingSelection] = useState<{
    url: string;
    resolved: ResolvedConfigurableProduct;
    selectedVariantCodes: string[];
  } | null>(null);
  const [isPending, startTransition] = useTransition();

  async function loadDashboard() {
    const response = await fetch("/api/watchlist/items", {
      cache: "no-store",
    });
    const payload = (await response.json()) as DashboardData & { error?: string };

    if (!response.ok) {
      throw new Error(payload.error ?? "Не успяхме да заредим списъка.");
    }

    setDashboard(payload);
  }

  function upsertWatch(updatedWatch: WatchView) {
    setDashboard((current) => {
      const watches = current.watches.some((watch) => watch.id === updatedWatch.id)
        ? current.watches.map((watch) =>
            watch.id === updatedWatch.id ? updatedWatch : watch,
          )
        : [updatedWatch, ...current.watches];

      return {
        ...current,
        watches,
      };
    });
  }

  async function createWatchRequest(urlToSave: string, variantCode?: string) {
    const response = await fetch("/api/watchlist/items", {
      method: "POST",
      headers: {
        "content-type": "application/json",
      },
      body: JSON.stringify({ url: urlToSave, variantCode }),
    });
    const payload = (await response.json()) as CreateWatchResult & { error?: string };

    if (!response.ok) {
      throw new Error(payload.error ?? "Не успяхме да добавим този Douglas линк.");
    }

    return payload;
  }

  async function persistWatch(urlToSave: string, variantCode?: string) {
    const payload = await createWatchRequest(urlToSave, variantCode);

    upsertWatch(payload.watch);
    setPendingSelection(null);
    setUrl("");
    setFeedback(
      payload.duplicate
        ? "Този вариант вече е в списъка."
        : payload.error
          ? "Продуктът е добавен, но първата проверка не успя."
          : "Продуктът е добавен успешно.",
    );
    await loadDashboard();
  }

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFeedback(null);

    startTransition(async () => {
      try {
        const response = await fetch("/api/watchlist/resolve", {
          method: "POST",
          headers: {
            "content-type": "application/json",
          },
          body: JSON.stringify({ url }),
        });
        const payload = (await response.json()) as ResolveDouglasResult & {
          error?: string;
        };

        if (!response.ok) {
          throw new Error(payload.error ?? "Не успяхме да добавим този Douglas линк.");
        }

        if (payload.resolved.kind === "configurable") {
          setPendingSelection({
            url: payload.resolved.canonicalUrl,
            resolved: payload.resolved,
            selectedVariantCodes: [],
          });
          setUrl(payload.resolved.canonicalUrl);
          setFeedback("Избери един или повече нюанси, преди да запазиш продукта.");
          return;
        }

        await persistWatch(payload.resolved.canonicalUrl);
      } catch (error) {
        setFeedback(error instanceof Error ? error.message : "Нещо се обърка. Опитай отново.");
      }
    });
  }

  function handleSaveSelectedVariants() {
    const selectedVariantCodes = pendingSelection?.selectedVariantCodes ?? [];

    if (!pendingSelection || selectedVariantCodes.length === 0) {
      setFeedback("Избери поне един нюанс.");
      return;
    }

    setFeedback(null);

    startTransition(async () => {
      const createdCodes: string[] = [];
      const duplicateCodes: string[] = [];
      const scrapeFailureCodes: string[] = [];
      const requestFailures: string[] = [];

      try {
        for (const selectedVariantCode of selectedVariantCodes) {
          try {
            const payload = await createWatchRequest(
              pendingSelection.url,
              selectedVariantCode,
            );

            upsertWatch(payload.watch);

            if (payload.duplicate) {
              duplicateCodes.push(selectedVariantCode);
            } else {
              createdCodes.push(selectedVariantCode);
            }

            if (payload.error) {
              scrapeFailureCodes.push(selectedVariantCode);
            }
          } catch {
            requestFailures.push(`${selectedVariantCode}: неуспешно добавяне.`);
          }
        }

        if (createdCodes.length > 0 || duplicateCodes.length > 0) {
          setPendingSelection(null);
          setUrl("");
          await loadDashboard();
        }

        const feedbackParts: string[] = [];

        if (createdCodes.length > 0) {
          feedbackParts.push(
            createdCodes.length === 1
              ? "1 нюанс е добавен."
              : `${createdCodes.length} нюанса са добавени.`,
          );
        }

        if (duplicateCodes.length > 0) {
          feedbackParts.push(
            duplicateCodes.length === 1
              ? "1 нюанс вече е в списъка."
              : `${duplicateCodes.length} нюанса вече са в списъка.`,
          );
        }

        if (scrapeFailureCodes.length > 0) {
          feedbackParts.push(
            scrapeFailureCodes.length === 1
              ? "За 1 нюанс първата проверка не успя."
              : `За ${scrapeFailureCodes.length} нюанса първата проверка не успя.`,
          );
        }

        if (requestFailures.length > 0) {
          feedbackParts.push(requestFailures.join(" "));
        }

        setFeedback(feedbackParts.join(" ") || "Не беше добавен нов нюанс.");
      } catch (error) {
        setFeedback(error instanceof Error ? error.message : "Нещо се обърка. Опитай отново.");
      }
    });
  }

  function handleRefresh(id: string) {
    setFeedback(null);

    startTransition(async () => {
      try {
        const response = await fetch(`/api/watchlist/items/${id}/refresh`, {
          method: "POST",
        });
        const payload = (await response.json()) as WatchMutationResult & { error?: string };

        if (!response.ok) {
          throw new Error(payload.error ?? "Не успяхме да обновим продукта.");
        }

        upsertWatch(payload.watch);
        setFeedback(
          payload.error
            ? "Не успяхме да обновим този продукт в момента."
            : "Продуктът е обновен.",
        );
        await loadDashboard();
      } catch (error) {
        setFeedback(error instanceof Error ? error.message : "Не успяхме да обновим продукта.");
      }
    });
  }

  const selectedVariants =
    pendingSelection?.resolved.variants.filter((variant) =>
      pendingSelection.selectedVariantCodes.includes(variant.variantCode),
    ) ?? [];
  const watchGroups = buildWatchGroups(dashboard.watches);

  function isGroupExpanded(group: WatchGroup) {
    return expandedGroups[group.key] ?? group.watches.length === 1;
  }

  function toggleGroup(group: WatchGroup) {
    setExpandedGroups((current) => ({
      ...current,
      [group.key]: !(current[group.key] ?? group.watches.length === 1),
    }));
  }

  return (
    <main className="relative min-h-screen overflow-hidden px-4 pb-12 pt-4 text-foreground sm:px-6 sm:pb-16 sm:pt-5 lg:px-10">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(214,86,136,0.18),transparent_34%),radial-gradient(circle_at_bottom_right,rgba(240,139,176,0.12),transparent_26%)]" />
      <div className="relative mx-auto flex w-full max-w-6xl flex-col">
        <div className="flex justify-end">
          <div className="inline-flex items-center gap-3 rounded-full border border-white/70 bg-white/72 px-3 py-2 text-sm shadow-[0_16px_40px_rgba(138,45,86,0.08)] backdrop-blur-sm">
            <span className="hidden max-w-[15rem] truncate text-muted sm:inline">
              {viewer.name ?? viewer.email ?? "Vikche"}
            </span>
            <button
              type="button"
              onClick={() => {
                void signOut({ callbackUrl: "/signin" });
              }}
              className="rounded-full px-3 py-1 font-semibold text-accent-strong transition hover:bg-accent-soft"
            >
              Изход
            </button>
          </div>
        </div>

        <section className="mx-auto flex min-h-[58vh] w-full max-w-3xl flex-col items-center justify-center pb-12 pt-8 text-center sm:min-h-[64vh] sm:pb-16 sm:pt-14">
          <h1 className="font-brand text-[5.7rem] leading-[0.8] tracking-[0.01em] text-accent-strong sm:text-[8.25rem] lg:text-[10.5rem]">
            Vikche
          </h1>
          <p className="mt-3 max-w-md text-base leading-7 text-muted sm:mt-4 sm:text-lg sm:leading-8">
            Проследявай цените на продуктите, които искаш!
          </p>

          <form onSubmit={handleSubmit} className="mt-8 w-full">
            <label htmlFor="douglas-url" className="sr-only">
              Постави линк към продукт от Douglas
            </label>
            <div className="rounded-[32px] border border-white/75 bg-white/82 p-3 shadow-[0_28px_70px_rgba(138,45,86,0.12)] backdrop-blur-sm sm:p-4">
              <div className="flex flex-col gap-3 sm:flex-row">
                <input
                  id="douglas-url"
                  value={url}
                  onChange={(event) => {
                    setUrl(event.target.value);

                    if (
                      pendingSelection &&
                      event.target.value.trim() !== pendingSelection.url
                    ) {
                      setPendingSelection(null);
                    }
                  }}
                  placeholder="https://douglas.bg/mac-lip-pencil-conf-78140"
                  className="min-h-14 w-full rounded-[24px] border border-transparent bg-[#fff8fb] px-4 py-4 text-[15px] outline-none transition focus:border-accent focus:ring-2 focus:ring-accent/15"
                />
                <button
                  type="submit"
                  disabled={isPending}
                  className="min-h-14 w-full rounded-[24px] bg-accent px-6 py-4 text-sm font-semibold text-white transition hover:bg-accent-strong disabled:cursor-not-allowed disabled:opacity-60 sm:w-auto sm:min-w-[11rem]"
                >
                  {isPending ? "Зареждане..." : "Добави продукт"}
                </button>
              </div>
            </div>
          </form>

          {feedback ? (
            <p className="mt-4 w-full rounded-[24px] border border-white/70 bg-white/76 px-4 py-3 text-sm leading-6 text-accent-strong shadow-[0_16px_35px_rgba(138,45,86,0.08)]">
              {feedback}
            </p>
          ) : null}
        </section>

        {pendingSelection ? (
          <section className="mx-auto w-full max-w-5xl rounded-[34px] border border-white/75 bg-white/84 p-4 shadow-[0_30px_80px_rgba(138,45,86,0.14)] backdrop-blur-sm sm:p-6">
            <div className="flex flex-col gap-5">
              <div className="space-y-3 text-center sm:text-left">
                <p className="text-xs uppercase tracking-[0.28em] text-muted">
                  Избери нюансите
                </p>
                <h2 className="text-2xl font-semibold text-accent-strong sm:text-3xl">
                  {pendingSelection.resolved.title}
                </h2>
                <p className="text-sm leading-7 text-muted">
                  Избери всички нюанси, които искаш Vikche да следи.
                  {pendingSelection.resolved.defaultVariantCode
                    ? ` Douglas в момента показва ${pendingSelection.resolved.defaultVariantCode} по подразбиране.`
                    : ""}
                </p>
              </div>

              {selectedVariants.length > 0 ? (
                <div className="flex flex-wrap justify-center gap-2 sm:justify-start">
                  {selectedVariants.map((variant) => (
                    <span
                      key={variant.variantCode}
                      className="rounded-full bg-accent-soft px-3 py-2 text-sm text-accent-strong"
                    >
                      {variant.variantLabel ?? variant.variantCode}
                      {variant.variantText ? ` · ${variant.variantText}` : ""}
                    </span>
                  ))}
                </div>
              ) : null}

              <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                {pendingSelection.resolved.variants.map((variant) => {
                  const isSelected =
                    pendingSelection.selectedVariantCodes.includes(variant.variantCode);

                  return (
                    <button
                      key={variant.variantCode}
                      type="button"
                      onClick={() =>
                        setPendingSelection((current) =>
                          current
                            ? {
                                ...current,
                                selectedVariantCodes: current.selectedVariantCodes.includes(
                                  variant.variantCode,
                                )
                                  ? current.selectedVariantCodes.filter(
                                      (code) => code !== variant.variantCode,
                                    )
                                  : [...current.selectedVariantCodes, variant.variantCode],
                              }
                            : current,
                        )
                      }
                      className={`rounded-[26px] border px-4 py-4 text-left transition ${
                        isSelected
                          ? "border-accent bg-accent-soft shadow-[0_16px_35px_rgba(214,86,136,0.12)]"
                          : "border-white/70 bg-[#fff9fc] hover:border-accent/40"
                      }`}
                    >
                      <p className="text-sm font-semibold text-accent-strong">
                        {variant.variantLabel ?? variant.variantCode}
                      </p>
                      <p className="mt-2 text-xs uppercase tracking-[0.2em] text-muted">
                        {variant.variantCode}
                      </p>
                      <p className="mt-3 text-sm text-muted">
                        {variant.variantText ?? "Без размер"}
                      </p>
                      <p className="mt-3 text-lg font-semibold text-accent-strong">
                        {formatPrice(variant.price)}
                      </p>
                      {variant.originalPrice ? (
                        <p className="mt-1 text-sm text-muted line-through">
                          {formatPrice(variant.originalPrice)}
                        </p>
                      ) : null}
                      <p className="mt-3 text-xs text-muted">
                        {variant.inStock ? "Наличен" : "Няма наличност"}
                      </p>
                      <p className="mt-2 text-xs font-semibold text-accent-strong">
                        {isSelected ? "Избран" : "Докосни за избор"}
                      </p>
                    </button>
                  );
                })}
              </div>

              <button
                type="button"
                onClick={handleSaveSelectedVariants}
                disabled={
                  isPending || pendingSelection.selectedVariantCodes.length === 0
                }
                className="min-h-14 w-full rounded-[24px] bg-accent px-5 py-4 text-sm font-semibold text-white transition hover:bg-accent-strong disabled:cursor-not-allowed disabled:opacity-60 sm:self-start sm:px-7"
              >
                {isPending
                  ? "Запазване..."
                  : `Запази избраните нюанси${
                      pendingSelection.selectedVariantCodes.length > 0
                        ? ` (${pendingSelection.selectedVariantCodes.length})`
                        : ""
                    }`}
              </button>
            </div>
          </section>
        ) : null}

        <section className="mt-10 w-full sm:mt-12">
          <div className="mb-5 flex items-end justify-between gap-4">
            <div>
              <p className="text-xs uppercase tracking-[0.28em] text-muted">
                Списък
              </p>
              <h2 className="mt-2 text-2xl font-semibold text-accent-strong sm:text-3xl">
                Следени продукти
              </h2>
            </div>
            <div className="text-right">
              <p className="text-sm text-muted">
                {watchGroups.length} {watchGroups.length === 1 ? "продукт" : "продукта"}
              </p>
              <p className="text-xs text-muted">
                {dashboard.watches.length}{" "}
                {dashboard.watches.length === 1 ? "следен вариант" : "следени варианта"}
              </p>
            </div>
          </div>

          {watchGroups.length === 0 ? (
            <div className="rounded-[30px] border border-dashed border-white/80 bg-white/58 px-6 py-10 text-center text-sm leading-7 text-muted">
              Добави първия продукт от Douglas, за да започнеш да следиш цените.
            </div>
          ) : (
            <div className="space-y-4 sm:space-y-5">
              {watchGroups.map((group) => {
                const allInStock = group.inStockCount === group.watches.length;
                const expanded = isGroupExpanded(group);

                return (
                  <article
                    key={group.key}
                    className="rounded-[32px] border border-white/75 bg-white/82 p-4 shadow-[0_24px_65px_rgba(138,45,86,0.11)] backdrop-blur-sm sm:p-6"
                  >
                    <div className="flex flex-col gap-5">
                      <div className="flex flex-col gap-4 sm:flex-row sm:items-start">
                        <div className="mx-auto h-28 w-24 overflow-hidden rounded-[28px] bg-[#fff0f6] sm:mx-0 sm:h-32 sm:w-28">
                          {group.imageUrl ? (
                            <Image
                              src={group.imageUrl}
                              alt={group.title ?? "Продукт от Douglas"}
                              width={224}
                              height={256}
                              className="h-full w-full object-cover"
                            />
                          ) : (
                            <div className="flex h-full items-center justify-center text-xs uppercase tracking-[0.28em] text-muted">
                              Douglas
                            </div>
                          )}
                        </div>

                        <div className="min-w-0 flex-1 text-center sm:text-left">
                          <button
                            type="button"
                            onClick={() => toggleGroup(group)}
                            aria-expanded={expanded}
                            className="mt-4 inline-flex min-h-12 w-full items-center justify-center rounded-full border border-white/80 bg-white px-4 py-3 text-sm font-semibold text-accent-strong transition hover:border-accent/45 hover:bg-[#fff8fb] sm:w-auto"
                          >
                            <div className="flex flex-wrap items-center justify-center gap-2">
                              <span className="rounded-full bg-accent-soft px-3 py-1 text-xs font-semibold text-accent-strong">
                                {variantCountLabel(group.watches.length)}
                              </span>
                              <span className="rounded-full bg-white px-3 py-1 text-xs font-semibold text-muted">
                                {allInStock
                                  ? "Всички налични"
                                  : `${group.inStockCount}/${group.watches.length} налични`}
                              </span>
                            </div>
                            <span className="text-sm font-semibold text-accent-strong">
                              {expanded ? "Скрий нюансите" : "Покажи нюансите"}
                            </span>
                          </button>

                          <h3 className="mt-3 break-words text-xl font-semibold leading-tight text-accent-strong sm:text-2xl">
                            {group.title ?? group.canonicalUrl}
                          </h3>

                          <p className="mt-2 text-sm leading-6 text-muted">
                            {group.lowestPrice !== null
                              ? `Най-добра текуща цена от ${formatPrice(group.lowestPrice)}`
                              : "Все още няма записана цена"}
                          </p>

                          {group.latestNotification ? (
                            <p className="mt-3 text-sm leading-6 text-accent-strong">
                              Последно намаление:{" "}
                              {formatPrice(group.latestNotification.previousPrice)} →{" "}
                              {formatPrice(group.latestNotification.currentPrice)}
                            </p>
                          ) : null}
                        </div>
                      </div>

                      <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
                        <a
                          href={group.canonicalUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex min-h-12 w-full items-center justify-center rounded-full border border-white/80 bg-white px-4 py-3 text-sm font-semibold text-accent-strong transition hover:border-accent/45 hover:bg-[#fff8fb] sm:w-auto"
                        >
                          Отвори в Douglas
                        </a>
                      </div>

                      {expanded ? (
                        <div className="space-y-3">
                          {group.watches.map((watch) => {
                            const latestNotification = latestNotificationFor(
                              watch.notifications,
                            );

                            return (
                              <div
                                key={watch.id}
                                className="rounded-[28px] bg-[#fff7fb] px-4 py-4 sm:px-5"
                              >
                                <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                                  <div className="min-w-0">
                                    <div className="flex flex-wrap items-center gap-2">
                                      <span
                                        className={`rounded-full px-3 py-1 text-xs font-semibold ${statusTone(watch)}`}
                                      >
                                        {statusLabel(watch)}
                                      </span>
                                    </div>
                                    <h4 className="mt-3 text-lg font-semibold text-accent-strong">
                                      {variantLabelFor(watch)}
                                    </h4>
                                    <p className="mt-1 text-sm text-muted">
                                      {variantMetaFor(watch)}
                                    </p>
                                    {latestNotification ? (
                                      <p className="mt-3 text-sm leading-6 text-accent-strong">
                                        Намаление: {formatPrice(latestNotification.previousPrice)} →{" "}
                                        {formatPrice(latestNotification.currentPrice)}
                                      </p>
                                    ) : null}
                                    <p className="mt-2 text-sm leading-6 text-muted">
                                      {statusMessage(watch)}
                                    </p>
                                  </div>

                                  <div className="sm:max-w-xs sm:text-right">
                                    <p className="text-xs uppercase tracking-[0.24em] text-muted">
                                      Текуща цена
                                    </p>
                                    <p className="mt-2 text-2xl font-semibold text-accent-strong">
                                      {formatPrice(watch.currentPrice)}
                                    </p>
                                    {watch.originalPrice ? (
                                      <p className="mt-2 text-sm text-muted line-through">
                                        {formatPrice(watch.originalPrice)}
                                      </p>
                                    ) : null}
                                    <p className="mt-3 text-sm font-semibold text-accent-strong">
                                      {formatDate(watch.lastCheckedAt)}
                                    </p>
                                  </div>
                                </div>

                                <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
                                  {watch.history.length === 0 ? (
                                    <p className="text-sm leading-6 text-muted">
                                      Все още няма записани цени.
                                    </p>
                                  ) : (
                                    <div className="flex gap-2 overflow-x-auto pb-1">
                                      {watch.history.slice(0, 3).map((snapshot) => (
                                        <div
                                          key={snapshot.id}
                                          className="min-w-[9.5rem] shrink-0 rounded-[20px] bg-white px-3 py-3 shadow-[0_8px_24px_rgba(138,45,86,0.06)]"
                                        >
                                          <p className="text-sm font-semibold text-accent-strong">
                                            {formatPrice(snapshot.price)}
                                          </p>
                                          <p className="mt-1 text-xs text-muted">
                                            {snapshot.inStock ? "Наличен" : "Няма наличност"}
                                          </p>
                                        </div>
                                      ))}
                                    </div>
                                  )}

                                  <button
                                    type="button"
                                    onClick={() => handleRefresh(watch.id)}
                                    disabled={isPending}
                                    className="min-h-12 w-full rounded-full border border-white/80 bg-white px-4 py-3 text-sm font-semibold text-accent-strong transition hover:border-accent/45 hover:bg-[#fff8fb] disabled:cursor-not-allowed disabled:opacity-60 sm:w-auto"
                                  >
                                    Обнови нюанса
                                  </button>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      ) : null}
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </section>
      </div>
    </main>
  );
}
