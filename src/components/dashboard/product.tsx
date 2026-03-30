import Image from "next/image";

import { useDashboard } from "./dashboard-context";
import { formatPrice, variantCountLabel, type WatchGroup } from "./helpers";
import { ProductShades } from "./product-shades";

export function Product({ group }: { group: WatchGroup }) {
  const { isGroupExpanded, toggleGroup } = useDashboard();
  const expanded = isGroupExpanded(group);
  const allInStock = group.inStockCount === group.watches.length;

  return (
    <article className="rounded-[32px] border border-white/75 bg-white/82 p-4 shadow-[0_24px_65px_rgba(138,45,86,0.11)] backdrop-blur-sm sm:p-6">
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
                Последно намаление: {formatPrice(group.latestNotification.previousPrice)} →{" "}
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
          <ProductShades watches={group.watches} />
        ) : null}
      </div>
    </article>
  );
}
