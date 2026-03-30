"use client";

import { signIn } from "next-auth/react";
import { useState, useTransition } from "react";

export function SignInCard(props: {
  googleEnabled: boolean;
  appleEnabled: boolean;
  authEnabled: boolean;
}) {
  const { googleEnabled, appleEnabled, authEnabled } = props;
  const [feedback, setFeedback] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleSignIn(provider: "google" | "apple") {
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

  const hasVisibleProvider = googleEnabled || appleEnabled;

  return (
    <section className="w-full max-w-xl text-center">
      <div className="space-y-4">
        <h1 className="font-brand text-[5.25rem] leading-[0.8] text-accent-strong sm:text-[7.5rem]">
          Vikche
        </h1>
        <p className="mx-auto max-w-lg text-base leading-7 text-muted sm:text-lg sm:leading-8">
          Влез, за да запазиш своя списък с продукти, да следиш желаните нюанси и
          да получаваш известия за намаления.
        </p>
      </div>

      <div className="mt-8 space-y-3 rounded-[32px] border border-white/75 bg-white/82 px-4 py-4 shadow-[0_28px_70px_rgba(138,45,86,0.12)] backdrop-blur-sm sm:px-5">
        {googleEnabled ? (
          <button
            type="button"
            onClick={() => handleSignIn("google")}
            disabled={isPending}
            className="flex min-h-14 w-full items-center justify-center rounded-full border border-white/80 bg-white px-5 py-3 text-sm font-semibold text-accent-strong transition hover:border-accent/40 hover:bg-[#fff7fb] disabled:cursor-not-allowed disabled:opacity-70"
          >
            {isPending ? "Свързваме те..." : "Вход с Google"}
          </button>
        ) : null}

        {appleEnabled ? (
          <button
            type="button"
            onClick={() => handleSignIn("apple")}
            disabled={isPending}
            className="flex min-h-14 w-full items-center justify-center rounded-full border border-white/80 bg-[#fff7fb] px-5 py-3 text-sm font-semibold text-accent-strong transition hover:border-accent/40 hover:bg-white disabled:cursor-not-allowed disabled:opacity-70"
          >
            {isPending ? "Свързваме те..." : "Вход с Apple"}
          </button>
        ) : null}

        {!hasVisibleProvider ? (
          <div className="rounded-[24px] border border-dashed border-white/75 bg-white/70 px-4 py-4 text-sm leading-6 text-muted">
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
