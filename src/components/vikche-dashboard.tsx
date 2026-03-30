"use client";

import Image from "next/image";
import { signOut } from "next-auth/react";
import { useState, useTransition } from "react";

import type {
  CreateWatchResult,
  DashboardData,
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

  return "bg-accent/10 text-accent";
}

function statusLabel(watch: WatchView) {
  if (watch.lastStatus === "error") {
    return "Нуждае се от внимание";
  }

  if (watch.lastStatus === "pending") {
    return "Проверява се";
  }

  if (watch.inStock === false) {
    return "Няма наличност";
  }

  return "Наличен";
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
            requestFailures.push(
              `${selectedVariantCode}: неуспешно добавяне.`,
            );
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

        setFeedback(
          feedbackParts.join(" ") ||
            "Не беше добавен нов нюанс.",
        );
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

  return (
    <main className="relative min-h-screen overflow-hidden px-4 py-5 text-foreground sm:px-6 sm:py-6 lg:px-10">
      <div className="absolute inset-x-0 top-0 h-72 bg-[radial-gradient(circle_at_top,rgba(214,86,136,0.22),transparent_58%)]" />
      <div className="mx-auto flex w-full max-w-7xl flex-col gap-6">
        <section className="glass-panel overflow-hidden rounded-[30px] border px-5 py-6 sm:px-8 sm:py-8 lg:px-10">
          <div className="space-y-8">
            <div className="max-w-3xl space-y-4">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                <div className="space-y-4">
                  <h1 className="font-display text-4xl leading-none text-accent-strong sm:text-5xl lg:text-6xl">
                    Vikche
                  </h1>
                  <p className="max-w-2xl text-lg leading-8 text-muted sm:text-xl">
                    Проследявай цените на продуктите, които искаш!
                  </p>
                </div>

                <div className="flex flex-col items-start gap-3 rounded-[24px] border border-line bg-white/85 px-4 py-4 text-left shadow-[0_18px_45px_rgba(110,41,73,0.08)] sm:min-w-[240px] sm:items-end">
                  <div>
                    <p className="text-sm font-semibold text-accent-strong">
                      {viewer.name ?? "Профил"}
                    </p>
                    <p className="mt-1 text-sm text-muted">
                      {viewer.email ?? "Влязъл профил"}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      void signOut({ callbackUrl: "/signin" });
                    }}
                    className="rounded-full border border-line bg-[#fff7fb] px-4 py-2 text-sm font-semibold text-accent-strong transition hover:border-accent/40 hover:bg-white"
                  >
                    Изход
                  </button>
                </div>
              </div>
            </div>

            <div className="max-w-4xl space-y-4">
              <form
                onSubmit={handleSubmit}
                className="rounded-[28px] border border-line bg-white/90 p-4 shadow-[0_20px_50px_rgba(110,41,73,0.12)]"
              >
                <label
                  htmlFor="douglas-url"
                  className="mb-3 block text-sm font-semibold text-accent-strong"
                >
                  Постави линк към продукт от Douglas
                </label>
                <div className="flex flex-col gap-3 lg:flex-row">
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
                    placeholder="https://douglas.bg/opi-infinite-shine-60448"
                    className="min-h-13 flex-1 rounded-2xl border border-line bg-[#fff7fb] px-4 py-3 text-sm outline-none transition focus:border-accent focus:ring-2 focus:ring-accent/15"
                  />
                  <button
                    type="submit"
                    disabled={isPending}
                    className="min-h-13 rounded-2xl bg-accent px-6 py-3 text-sm font-semibold text-white transition hover:bg-accent-strong disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {isPending ? "Зареждане..." : "Добави продукт"}
                  </button>
                </div>
              </form>

              {feedback ? (
                <p className="rounded-2xl border border-line bg-white/70 px-4 py-3 text-sm text-accent-strong">
                  {feedback}
                </p>
              ) : null}
            </div>

            {pendingSelection ? (
              <section className="rounded-[28px] border border-line bg-white/90 p-4 shadow-[0_20px_50px_rgba(110,41,73,0.12)]">
                <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                  <div className="space-y-2">
                    <p className="text-xs uppercase tracking-[0.35em] text-muted">
                      Избери Нюанси
                    </p>
                    <h2 className="font-display text-2xl text-accent-strong">
                      {pendingSelection.resolved.title}
                    </h2>
                    <p className="text-sm leading-6 text-muted">
                      Избери всички нюанси, които искаш Vikche да следи.
                      {pendingSelection.resolved.defaultVariantCode
                        ? ` Douglas в момента показва ${pendingSelection.resolved.defaultVariantCode} по подразбиране.`
                        : ""}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={handleSaveSelectedVariants}
                    disabled={
                      isPending || pendingSelection.selectedVariantCodes.length === 0
                    }
                    className="w-full rounded-2xl bg-accent px-5 py-3 text-sm font-semibold text-white transition hover:bg-accent-strong disabled:cursor-not-allowed disabled:opacity-60 lg:w-auto"
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

                {selectedVariants.length > 0 ? (
                  <div className="mt-4 rounded-[24px] border border-line bg-[#fff4fa] p-4">
                    <p className="text-sm font-semibold text-accent-strong">
                      Избрани нюанси: {selectedVariants.length}
                    </p>
                    <div className="mt-3 flex flex-wrap gap-2">
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
                  </div>
                ) : null}

                <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
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
                                    : [
                                        ...current.selectedVariantCodes,
                                        variant.variantCode,
                                      ],
                                }
                              : current
                          )
                        }
                        className={`rounded-[24px] border p-4 text-left transition ${
                          isSelected
                            ? "border-accent bg-accent-soft shadow-[0_12px_30px_rgba(214,86,136,0.12)]"
                            : "border-line bg-[#fff7fb] hover:border-accent/40"
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
              </section>
            ) : null}

            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
              <div className="rounded-[28px] border border-line bg-[#fff0f6] p-5">
                <p className="text-xs uppercase tracking-[0.28em] text-muted">
                  Продукти
                </p>
                <p className="mt-4 font-display text-5xl text-accent-strong">
                  {dashboard.stats.watchCount}
                </p>
                <p className="mt-3 text-sm leading-6 text-muted">
                  Продукти в твоя списък.
                </p>
              </div>
              <div className="rounded-[28px] border border-line bg-[#fff5fa] p-5">
                <p className="text-xs uppercase tracking-[0.28em] text-muted">
                  Налични
                </p>
                <p className="mt-4 font-display text-5xl text-accent-strong">
                  {dashboard.stats.inStockCount}
                </p>
                <p className="mt-3 text-sm leading-6 text-muted">
                  Продукти с налична последна оферта.
                </p>
              </div>
              <div className="rounded-[28px] border border-line bg-[#ffeef4] p-5">
                <p className="text-xs uppercase tracking-[0.28em] text-muted">
                  За проверка
                </p>
                <p className="mt-4 font-display text-5xl text-accent-strong">
                  {dashboard.stats.dueCount}
                </p>
                <p className="mt-3 text-sm leading-6 text-muted">
                  Продукти, които чакат следваща проверка.
                </p>
              </div>
              <div className="rounded-[28px] border border-line bg-[#fff2f7] p-5">
                <p className="text-xs uppercase tracking-[0.28em] text-muted">
                  Намаления
                </p>
                <p className="mt-4 font-display text-5xl text-accent-strong">
                  {dashboard.stats.priceDropCount}
                </p>
                <p className="mt-3 text-sm leading-6 text-muted">
                  Засечени по-ниски цени.
                </p>
              </div>
            </div>
          </div>
        </section>

        <section className="grid gap-6 xl:grid-cols-[1.3fr_0.7fr]">
          <div className="glass-panel rounded-[32px] border p-5 sm:p-6">
            <div className="mb-5 border-b border-line pb-5">
              <div>
                <p className="text-xs uppercase tracking-[0.35em] text-muted">
                  Списък
                </p>
                <h2 className="mt-2 font-display text-3xl text-accent-strong">
                  Следени продукти
                </h2>
              </div>
            </div>

            <div className="space-y-4">
              {dashboard.watches.length === 0 ? (
                <div className="rounded-[28px] border border-dashed border-line bg-white/55 px-6 py-10 text-center text-sm leading-7 text-muted">
                  Добави първия продукт от Douglas, за да започнеш да следиш цените.
                </div>
              ) : (
                dashboard.watches.map((watch) => (
                  <article
                    key={watch.id}
                    className="rounded-[28px] border border-line bg-white/70 p-4 shadow-[0_12px_40px_rgba(110,41,73,0.1)] sm:p-5"
                  >
                    <div className="flex flex-col gap-5 lg:flex-row lg:items-start">
                      <div className="flex min-w-0 flex-1 items-start gap-4">
                        <div className="h-24 w-20 overflow-hidden rounded-[24px] border border-line bg-[#fff1f7] sm:h-28 sm:w-24">
                          {watch.imageUrl ? (
                            <Image
                              src={watch.imageUrl}
                              alt={watch.title ?? "Продукт от Douglas"}
                              width={192}
                              height={224}
                              className="h-full w-full object-cover"
                            />
                          ) : (
                            <div className="flex h-full items-center justify-center text-xs uppercase tracking-[0.28em] text-muted">
                              Douglas
                            </div>
                          )}
                        </div>
                        <div className="min-w-0 flex-1 space-y-2">
                          <div className="flex flex-wrap items-center gap-2">
                            <span
                              className={`rounded-full px-3 py-1 text-xs font-semibold ${statusTone(watch)}`}
                            >
                              {statusLabel(watch)}
                            </span>
                          </div>
                          <h3 className="max-w-xl break-words font-display text-xl leading-tight text-accent-strong sm:text-2xl">
                            {watch.title ?? watch.canonicalUrl}
                          </h3>
                          <p className="text-sm text-muted">
                            Код на продукта: {watch.productCode ?? "Неизвестен"}
                            {watch.variantLabel ? ` · Нюанс ${watch.variantLabel}` : ""}
                            {watch.variantText ? ` · ${watch.variantText}` : ""}
                          </p>
                          <div className="flex flex-wrap gap-3 text-sm text-muted">
                            <a
                              href={watch.canonicalUrl}
                              target="_blank"
                              rel="noreferrer"
                              className="rounded-full border border-line bg-white px-3 py-1 hover:border-accent hover:text-accent"
                            >
                              Отвори в Douglas
                            </a>
                            <button
                              type="button"
                              onClick={() => handleRefresh(watch.id)}
                              disabled={isPending}
                              className="rounded-full border border-line bg-white px-3 py-1 hover:border-accent hover:text-accent disabled:cursor-not-allowed disabled:opacity-60"
                            >
                              Обнови
                            </button>
                          </div>
                        </div>
                      </div>

                      <div className="grid gap-3 sm:grid-cols-3 lg:w-[24rem] lg:flex-none xl:w-[28rem]">
                        <div className="rounded-3xl bg-[#fff4fa] p-4">
                          <p className="text-xs uppercase tracking-[0.28em] text-muted">
                            Текуща цена
                          </p>
                          <p className="mt-3 text-2xl font-semibold text-accent-strong">
                            {formatPrice(watch.currentPrice)}
                          </p>
                          {watch.originalPrice ? (
                            <p className="mt-2 text-sm text-muted line-through">
                              {formatPrice(watch.originalPrice)}
                            </p>
                          ) : (
                            <p className="mt-2 text-sm text-muted">
                              Няма предишна цена
                            </p>
                          )}
                        </div>
                        <div className="rounded-3xl bg-[#fff7fb] p-4">
                          <p className="text-xs uppercase tracking-[0.28em] text-muted">
                            Последна проверка
                          </p>
                          <p className="mt-3 text-sm font-semibold leading-6 text-accent-strong">
                            {formatDate(watch.lastCheckedAt)}
                          </p>
                          <p className="mt-2 text-sm text-muted">
                            {watch.lastStatus === "error"
                              ? "Не успяхме да обновим този продукт при последната проверка."
                              : "Последната цена е запазена."}
                          </p>
                        </div>
                        <div className="rounded-3xl bg-[#fff0f6] p-4">
                          <p className="text-xs uppercase tracking-[0.28em] text-muted">
                            Известия
                          </p>
                          <p className="mt-3 text-2xl font-semibold text-accent-strong">
                            {watch.notifications.length}
                          </p>
                          <p className="mt-2 text-sm text-muted">
                            {watch.lastNotificationAt
                              ? `Последно известие ${formatDate(watch.lastNotificationAt)}`
                              : "Все още няма известия за намаление"}
                          </p>
                        </div>
                      </div>
                    </div>

                    <div className="mt-5">
                      <div className="rounded-[26px] border border-line bg-[#fff7fb] p-4">
                        <div className="mb-4 flex items-center justify-between">
                          <p className="text-sm font-semibold text-accent-strong">
                            Последни цени
                          </p>
                          <p className="text-xs uppercase tracking-[0.28em] text-muted">
                            {watch.history.length} записа
                          </p>
                        </div>
                        <div className="space-y-3">
                          {watch.history.length === 0 ? (
                            <p className="text-sm text-muted">
                              Все още няма записани цени.
                            </p>
                          ) : (
                            watch.history.map((snapshot) => (
                              <div
                                key={snapshot.id}
                                className="flex flex-col gap-2 rounded-2xl bg-white px-3 py-3 text-sm sm:flex-row sm:items-center sm:justify-between"
                              >
                                <div>
                                  <p className="font-semibold text-accent-strong">
                                    {formatPrice(snapshot.price)}
                                  </p>
                                  <p className="text-xs text-muted">
                                    {snapshot.inStock ? "Наличен" : "Няма наличност"}
                                  </p>
                                </div>
                                <p className="text-xs text-muted">
                                  {formatDate(snapshot.scrapedAt)}
                                </p>
                              </div>
                            ))
                          )}
                        </div>
                      </div>
                    </div>
                  </article>
                ))
              )}
            </div>
          </div>

          <aside className="glass-panel rounded-[32px] border p-5 sm:p-6">
            <div className="border-b border-line pb-5">
              <p className="text-xs uppercase tracking-[0.35em] text-muted">
                Известия
              </p>
              <h2 className="mt-2 font-display text-3xl text-accent-strong">
                Последни известия
              </h2>
              <p className="mt-3 text-sm leading-6 text-muted">
                Когато цената падне, ще видиш известието тук.
              </p>
            </div>

            <div className="mt-5 space-y-3">
              {dashboard.recentNotifications.length === 0 ? (
                <div className="rounded-[26px] border border-dashed border-line bg-white/55 px-5 py-8 text-sm leading-6 text-muted">
                  Все още няма намаления. Когато засечем по-ниска цена, тя ще се появи тук.
                </div>
              ) : (
                dashboard.recentNotifications.map((notification) => (
                  <div
                    key={notification.id}
                    className="rounded-[24px] border border-line bg-white/70 p-4"
                  >
                    <div className="flex items-center justify-between gap-3">
                      <p className="text-sm font-semibold text-accent-strong">
                        {notification.subject}
                      </p>
                    </div>
                    <p className="mt-3 text-sm text-muted">
                      {formatPrice(notification.previousPrice)} → {formatPrice(notification.currentPrice)}
                    </p>
                    <p className="mt-2 text-xs leading-5 text-muted">
                      {notification.message}
                    </p>
                    <p className="mt-3 text-xs uppercase tracking-[0.24em] text-muted">
                      {formatDate(notification.createdAt)}
                    </p>
                  </div>
                ))
              )}
            </div>
          </aside>
        </section>
      </div>
    </main>
  );
}
