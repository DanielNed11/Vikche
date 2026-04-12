import { useDashboard } from "./dashboard-context";
import {
  formatPrice,
  normalizeProductImageUrl,
  statusLabel,
  variantCountLabel,
  type WatchGroup,
} from "./helpers";
import { ProductShades } from "./product-shades";

export function Product({ group }: { group: WatchGroup }) {
  const { isGroupExpanded, toggleGroup, isPending, isBusy, handleRefresh, handleRemove } =
    useDashboard();
  const expanded = isGroupExpanded(group);
  const imageUrl = normalizeProductImageUrl(group.imageUrl);
  const hasVariants = group.watches.length > 1;
  const primaryWatch = group.watches[0] ?? null;

  return (
    <article className="rounded-[32px] border border-white/75 bg-white/82 p-4 shadow-[0_24px_65px_rgba(138,45,86,0.11)] backdrop-blur-sm sm:p-6">
      <div className="flex flex-col gap-5">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start">
          <div className="mx-auto h-28 w-24 overflow-hidden rounded-[28px] bg-[#fff0f6] sm:mx-0 sm:h-32 sm:w-28">
            {imageUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={imageUrl}
                alt={group.title ?? "Продукт"}
                loading="lazy"
                referrerPolicy="no-referrer"
                className="h-full w-full object-cover"
              />
            ) : (
              <div className="flex h-full items-center justify-center text-xs uppercase tracking-[0.28em] text-muted">
                Vikche
              </div>
            )}
          </div>

          <div className="min-w-0 flex-1 text-center sm:text-left">
            <div className="mt-1 flex flex-wrap items-center justify-center gap-2 sm:justify-start">
              <span className="rounded-full bg-accent-soft px-3 py-1 text-xs font-semibold text-accent-strong">
                {variantCountLabel(group.watches.length)}
              </span>
              <span className="rounded-full bg-white px-3 py-1 text-xs font-semibold text-muted">
                {group.inStockCount > 0
                  ? `${group.inStockCount} ${
                      group.inStockCount === 1 ? "наличен вариант" : "налични варианта"
                    }`
                  : group.unknownStockCount > 0
                    ? "Наличността се уточнява"
                    : "В момента няма наличност"}
              </span>
            </div>

            <h3 className="mt-4 break-words text-xl font-semibold leading-tight text-accent-strong sm:text-2xl">
              {group.title ?? group.canonicalUrl}
            </h3>

            <p className="mt-2 text-sm leading-6 text-muted">
              {group.lowestPrice !== null
                ? `Най-добра текуща цена от ${formatPrice(group.lowestPrice)}`
                : "Все още няма записана цена"}
            </p>

            {!hasVariants && primaryWatch ? (
              <div className="mt-4 rounded-[24px] border border-white/70 bg-[#fff8fb] px-4 py-4 shadow-[0_14px_32px_rgba(138,45,86,0.06)] sm:max-w-sm">
                <p className="text-xs uppercase tracking-[0.24em] text-muted">
                  Текуща цена
                </p>
                <p className="mt-2 text-3xl font-semibold text-accent-strong">
                  {formatPrice(primaryWatch.currentPrice)}
                </p>
                {primaryWatch.originalPrice ? (
                  <p className="mt-2 text-sm text-muted line-through">
                    {formatPrice(primaryWatch.originalPrice)}
                  </p>
                ) : null}
                <div className="mt-3 flex flex-wrap items-center gap-2">
                  <span className="rounded-full bg-white px-3 py-1 text-xs font-semibold text-muted">
                    {statusLabel(primaryWatch)}
                  </span>
                  {primaryWatch.discountCode ? (
                    <span className="rounded-full bg-accent-soft px-3 py-1 text-xs font-semibold text-accent-strong">
                      Код: {primaryWatch.discountCode}
                    </span>
                  ) : null}
                </div>
              </div>
            ) : null}

            {group.latestNotification ? (
              <p className="mt-3 text-sm leading-6 text-accent-strong">
                Последно намаление: {formatPrice(group.latestNotification.previousPrice)} →{" "}
                {formatPrice(group.latestNotification.currentPrice)}
              </p>
            ) : null}
          </div>
        </div>

        <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
          {hasVariants ? (
            <button
              type="button"
              onClick={() => toggleGroup(group)}
              aria-expanded={expanded}
              className="inline-flex min-h-12 w-full items-center justify-center rounded-full border border-white/80 bg-white px-4 py-3 text-sm font-semibold text-accent-strong transition hover:border-accent/45 hover:bg-[#fff8fb] sm:w-auto"
            >
              {expanded ? "Скрий вариантите" : "Покажи вариантите"}
            </button>
          ) : primaryWatch ? (
            <>
              <button
                type="button"
                onClick={() => handleRefresh(primaryWatch.id)}
                disabled={isPending || isBusy}
                className="inline-flex min-h-12 w-full items-center justify-center rounded-full border border-white/80 bg-white px-4 py-3 text-sm font-semibold text-accent-strong transition hover:border-accent/45 hover:bg-[#fff8fb] disabled:cursor-not-allowed disabled:opacity-60 sm:w-auto"
              >
                Обнови
              </button>
              <button
                type="button"
                onClick={() => handleRemove(primaryWatch.id)}
                disabled={isPending || isBusy}
                className="inline-flex min-h-12 w-full items-center justify-center rounded-full border border-white/80 bg-white px-4 py-3 text-sm font-semibold text-accent-strong transition hover:border-danger/45 hover:bg-[#fff8fb] disabled:cursor-not-allowed disabled:opacity-60 sm:w-auto"
              >
                Премахни
              </button>
            </>
          ) : null}
          <a
            href={group.canonicalUrl}
            target="_blank"
            rel="noreferrer"
            className="inline-flex min-h-12 w-full items-center justify-center rounded-full border border-white/80 bg-white px-4 py-3 text-sm font-semibold text-accent-strong transition hover:border-accent/45 hover:bg-[#fff8fb] sm:w-auto"
          >
            Отвори продукта
          </a>
        </div>

        {hasVariants && expanded ? (
          <ProductShades watches={group.watches} />
        ) : null}
      </div>
    </article>
  );
}
