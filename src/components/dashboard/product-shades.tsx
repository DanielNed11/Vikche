import type { WatchView } from "@/lib/types";

import { useDashboard } from "./dashboard-context";
import {
  formatDate,
  formatPrice,
  latestNotificationFor,
  statusLabel,
  statusMessage,
  statusTone,
  variantLabelFor,
  variantMetaFor,
} from "./helpers";
export function ProductShades({ watches }: { watches: WatchView[] }) {
  const { isPending, isBusy, handleRefresh, handleRemove } = useDashboard();

  return (
    <div className="space-y-3">
      {watches.map((watch) => {
        const latestNotification = latestNotificationFor(watch.notifications);

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
                {variantMetaFor(watch) ? (
                  <p className="mt-1 text-sm text-muted">
                    {variantMetaFor(watch)}
                  </p>
                ) : null}
                {latestNotification ? (
                  <p className="mt-3 text-sm leading-6 text-accent-strong">
                    Намаление: {formatPrice(latestNotification.previousPrice)} →{" "}
                    {formatPrice(latestNotification.currentPrice)}
                  </p>
                ) : null}
                {watch.discountCode ? (
                  <p className="mt-2 text-sm leading-6 text-accent-strong">
                    Код за отстъпка: <span className="font-semibold">{watch.discountCode}</span>
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

            <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:justify-end">
              <button
                type="button"
                onClick={() => handleRefresh(watch.id)}
                disabled={isPending || isBusy}
                className="min-h-12 w-full rounded-full border border-white/80 bg-white px-4 py-3 text-sm font-semibold text-accent-strong transition hover:border-accent/45 hover:bg-[#fff8fb] disabled:cursor-not-allowed disabled:opacity-60 sm:w-auto"
              >
                Обнови
              </button>
              <button
                type="button"
                onClick={() => handleRemove(watch.id)}
                disabled={isPending || isBusy}
                className="min-h-12 w-full rounded-full border border-white/80 bg-white px-4 py-3 text-sm font-semibold text-accent-strong transition hover:border-danger/45 hover:bg-[#fff8fb] disabled:cursor-not-allowed disabled:opacity-60 sm:w-auto"
              >
                Премахни
              </button>
            </div>
          </div>
        );
      })}
    </div>
  );
}
