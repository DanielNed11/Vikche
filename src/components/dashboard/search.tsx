import { useDashboard } from "./dashboard-context";

export function Search() {
  const {
    url,
    feedback,
    isBusy,
    handleSubmit,
    handleUrlChange,
  } = useDashboard();

  return (
    <section className="mx-auto flex min-h-[58vh] w-full max-w-3xl flex-col items-center justify-center pb-12 pt-8 text-center sm:min-h-[64vh] sm:pb-16 sm:pt-14">
      <h1 className="font-brand text-[5.7rem] leading-[0.8] tracking-[0.01em] text-accent-strong sm:text-[8.25rem] lg:text-[10.5rem]">
        Vikche
      </h1>
      <p className="mt-3 max-w-md text-base leading-7 text-muted sm:mt-4 sm:text-lg sm:leading-8">
        Проследявай цените на продуктите, които искаш!
      </p>

      <form onSubmit={handleSubmit} className="mt-8 w-full">
        <label htmlFor="product-url" className="sr-only">
          Постави линк към продукт
        </label>
        <div className="rounded-[32px] border border-white/75 bg-white/82 p-3 shadow-[0_28px_70px_rgba(138,45,86,0.12)] backdrop-blur-sm sm:p-4">
          <div className="flex flex-col gap-3 sm:flex-row">
            <input
              id="product-url"
              value={url}
              onChange={(event) => handleUrlChange(event.target.value)}
              disabled={isBusy}
              placeholder="https://example.com/product"
              className="min-h-14 w-full rounded-[24px] border border-transparent bg-[#fff8fb] px-4 py-4 text-[15px] outline-none transition focus:border-accent focus:ring-2 focus:ring-accent/15 disabled:cursor-not-allowed disabled:opacity-70"
            />
            <button
              type="submit"
              disabled={isBusy}
              className="min-h-14 w-full rounded-[24px] bg-accent px-6 py-4 text-sm font-semibold text-white transition hover:bg-accent-strong disabled:cursor-not-allowed disabled:opacity-60 sm:w-auto sm:min-w-[11rem]"
            >
              Добави продукт
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
  );
}
