"use client";

import { signIn } from "next-auth/react";
import { useState, useTransition } from "react";

export function SignInCard(props: {
  googleEnabled: boolean;
  appleEnabled: boolean;
  devLoginEnabled: boolean;
  authEnabled: boolean;
}) {
  const { googleEnabled, appleEnabled, devLoginEnabled, authEnabled } = props;
  const [feedback, setFeedback] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleSignIn(provider: "google" | "apple" | "credentials") {
    setFeedback(null);

    startTransition(async () => {
      try {
        await signIn(provider, {
          callbackUrl: "/",
        });
      } catch {
        setFeedback("Не успяхме да започнем входа. Опитай отново.");
      }
    });
  }

  const hasVisibleProvider = googleEnabled || appleEnabled || devLoginEnabled;

  return (
    <section className="glass-panel w-full max-w-xl rounded-[30px] border px-6 py-7 shadow-[0_28px_80px_rgba(110,41,73,0.18)] sm:px-8 sm:py-9">
      <div className="space-y-4">
        <p className="text-sm uppercase tracking-[0.28em] text-muted">
          Вход
        </p>
        <h1 className="font-display text-4xl leading-none text-accent-strong sm:text-5xl">
          Vikche
        </h1>
        <p className="max-w-lg text-base leading-7 text-muted sm:text-lg">
          Влез, за да запазиш своя списък с продукти, да следиш желаните нюанси и
          да получаваш известия за намаления.
        </p>
      </div>

      <div className="mt-8 space-y-3">
        {googleEnabled ? (
          <button
            type="button"
            onClick={() => handleSignIn("google")}
            disabled={isPending}
            className="flex w-full items-center justify-center rounded-full border border-line bg-white px-5 py-3 text-sm font-semibold text-accent-strong transition hover:border-accent/40 hover:bg-[#fff7fb] disabled:cursor-not-allowed disabled:opacity-70"
          >
            {isPending ? "Свързваме те..." : "Вход с Google"}
          </button>
        ) : null}

        {appleEnabled ? (
          <button
            type="button"
            onClick={() => handleSignIn("apple")}
            disabled={isPending}
            className="flex w-full items-center justify-center rounded-full border border-line bg-[#fff7fb] px-5 py-3 text-sm font-semibold text-accent-strong transition hover:border-accent/40 hover:bg-white disabled:cursor-not-allowed disabled:opacity-70"
          >
            {isPending ? "Свързваме те..." : "Вход с Apple"}
          </button>
        ) : null}

        {devLoginEnabled ? (
          <button
            type="button"
            onClick={() => handleSignIn("credentials")}
            disabled={isPending}
            className="flex w-full items-center justify-center rounded-full border border-line bg-[#fff0f6] px-5 py-3 text-sm font-semibold text-accent-strong transition hover:border-accent/40 hover:bg-white disabled:cursor-not-allowed disabled:opacity-70"
          >
            {isPending ? "Свързваме те..." : "Локален вход за разработка"}
          </button>
        ) : null}

        {!hasVisibleProvider ? (
          <div className="rounded-[24px] border border-dashed border-line bg-white/70 px-4 py-4 text-sm leading-6 text-muted">
            {authEnabled
              ? "Няма активен доставчик за вход."
              : "SSO още не е конфигуриран. Добави OAuth данните в env променливите и презареди приложението."}
          </div>
        ) : null}

        {feedback ? (
          <div className="rounded-[22px] border border-danger/20 bg-danger/5 px-4 py-3 text-sm text-danger">
            {feedback}
          </div>
        ) : null}
      </div>
    </section>
  );
}
