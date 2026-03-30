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
import { LoadingLabel } from "./loading";

export function ProductShades({ watches }: { watches: WatchView[] }) {
  const { isPending, handleRefresh } = useDashboard();

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
                <LoadingLabel
                  isPending={isPending}
                  idle="Обнови нюанса"
                  loading="Обновяване..."
                />
              </button>
            </div>
          </div>
        );
      })}
    </div>
  );
}
