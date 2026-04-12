import { useDashboard } from "./dashboard-context";
import { Product } from "./product";

export function ProductList() {
  const { watchGroups } = useDashboard();

  return (
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
            {watchGroups.length}{" "}
            {watchGroups.length === 1 ? "продукт" : "продукта"}
          </p>
        </div>
      </div>

      {watchGroups.length === 0 ? (
        <div className="rounded-[30px] border border-dashed border-white/80 bg-white/58 px-6 py-10 text-center text-sm leading-7 text-muted">
          Добави първия продукт, за да започнеш да следиш цените.
        </div>
      ) : (
        <div className="space-y-4 sm:space-y-5">
          {watchGroups.map((group) => (
            <Product key={group.key} group={group} />
          ))}
        </div>
      )}
    </section>
  );
}
