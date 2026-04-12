import { useDashboard } from "./dashboard-context";
import { formatPrice } from "./helpers";
import { LoadingLabel } from "./loading";

export function ChooseShade() {
  const {
    pendingSelection,
    selectedVariants,
    isPending,
    handleToggleVariant,
    handleSaveSelectedVariants,
  } = useDashboard();

  if (!pendingSelection) {
    return null;
  }

  return (
    <section className="mx-auto w-full max-w-5xl rounded-[34px] border border-white/75 bg-white/84 p-4 shadow-[0_30px_80px_rgba(138,45,86,0.14)] backdrop-blur-sm sm:p-6">
      <div className="flex flex-col gap-5">
        <div className="space-y-3 text-center sm:text-left">
          <p className="text-xs uppercase tracking-[0.28em] text-muted">
            Избери вариантите
          </p>
          <h2 className="text-2xl font-semibold text-accent-strong sm:text-3xl">
            {pendingSelection.resolved.title}
          </h2>
          <p className="text-sm leading-7 text-muted">
            Избери всички варианти, които искаш Vikche да следи.
          </p>
          {pendingSelection.resolved.discountCode ? (
            <p className="text-sm leading-7 text-accent-strong">
              Код за отстъпка:{" "}
              <span className="font-semibold">{pendingSelection.resolved.discountCode}</span>
            </p>
          ) : null}
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
                onClick={() => handleToggleVariant(variant.variantCode)}
                className={`rounded-[26px] border px-4 py-4 text-left transition ${
                  isSelected
                    ? "border-accent bg-accent-soft shadow-[0_16px_35px_rgba(214,86,136,0.12)]"
                    : "border-white/70 bg-[#fff9fc] hover:border-accent/40"
                }`}
              >
                <p className="text-sm font-semibold text-accent-strong">
                  {variant.variantLabel ?? variant.variantText ?? "Вариант"}
                </p>
                {variant.variantText ? (
                  <p className="mt-3 text-sm text-muted">{variant.variantText}</p>
                ) : null}
                <p className="mt-3 text-lg font-semibold text-accent-strong">
                  {formatPrice(variant.price)}
                </p>
                {variant.originalPrice ? (
                  <p className="mt-1 text-sm text-muted line-through">
                    {formatPrice(variant.originalPrice)}
                  </p>
                ) : null}
                <p className="mt-3 text-xs text-muted">
                  {variant.inStock ? "Наличен" : "В момента няма наличност"}
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
          disabled={isPending || pendingSelection.selectedVariantCodes.length === 0}
          className="min-h-14 w-full rounded-[24px] bg-accent px-5 py-4 text-sm font-semibold text-white transition hover:bg-accent-strong disabled:cursor-not-allowed disabled:opacity-60 sm:self-start sm:px-7"
        >
          <LoadingLabel
            isPending={isPending}
            loading="Запазване..."
            idle={`Запази избраните варианти${
              pendingSelection.selectedVariantCodes.length > 0
                ? ` (${pendingSelection.selectedVariantCodes.length})`
                : ""
            }`}
          />
        </button>
      </div>
    </section>
  );
}
