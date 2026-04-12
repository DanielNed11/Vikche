"use client";

import { signIn } from "next-auth/react";
import { useState, useTransition, type FormEvent } from "react";

export function SignInCard(props: {
  credentialsEnabled: boolean;
  authEnabled: boolean;
}) {
  const { credentialsEnabled, authEnabled } = props;
  const [feedback, setFeedback] = useState<string | null>(null);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isPending, startTransition] = useTransition();

  function handleSignIn(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFeedback(null);

    const nextEmail = email.trim();
    const nextPassword = password.trim();

    if (!nextEmail || !nextPassword) {
      setFeedback("Попълни имейл и парола.");
      return;
    }

    startTransition(async () => {
      try {
        const result = await signIn("credentials", {
          email: nextEmail,
          password: nextPassword,
          callbackUrl: "/",
          redirect: false,
        });

        if (result?.error) {
          setFeedback("Имейлът или паролата не са приети.");
          return;
        }

        window.location.assign(result?.url || "/");
      } catch {
        setFeedback("Не успяхме да започнем входа. Опитай отново.");
      }
    });
  }

  return (
    <section className="w-full max-w-xl text-center">
      <div className="space-y-4">
        <h1 className="font-brand text-[5.25rem] leading-[0.8] text-accent-strong sm:text-[7.5rem]">
          Vikche
        </h1>
        <p className="mx-auto max-w-lg text-base leading-7 text-muted sm:text-lg sm:leading-8">
          Влез, за да запазиш своя списък с продукти, да следиш желаните варианти и
          да получаваш известия за намаления.
        </p>
      </div>

      <div className="mt-8 rounded-[32px] border border-white/75 bg-white/82 px-4 py-4 shadow-[0_28px_70px_rgba(138,45,86,0.12)] backdrop-blur-sm sm:px-5">
        {credentialsEnabled ? (
          <form onSubmit={handleSignIn} className="space-y-3">
            <input
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder="you@example.com"
              autoComplete="email"
              disabled={isPending}
              className="min-h-14 w-full rounded-full border border-white/80 bg-white px-5 py-3 text-sm text-accent-strong outline-none transition focus:border-accent/40 disabled:cursor-not-allowed disabled:opacity-70"
            />
            <input
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              placeholder="Парола"
              autoComplete="current-password"
              disabled={isPending}
              className="min-h-14 w-full rounded-full border border-white/80 bg-white px-5 py-3 text-sm text-accent-strong outline-none transition focus:border-accent/40 disabled:cursor-not-allowed disabled:opacity-70"
            />
            <button
              type="submit"
              disabled={isPending}
              className="flex min-h-14 w-full items-center justify-center rounded-full border border-white/80 bg-white px-5 py-3 text-sm font-semibold text-accent-strong transition hover:border-accent/40 hover:bg-[#fff7fb] disabled:cursor-not-allowed disabled:opacity-70"
            >
              {isPending ? "Свързваме те..." : "Вход"}
            </button>
          </form>
        ) : (
          <div className="rounded-[24px] border border-dashed border-white/75 bg-white/70 px-4 py-4 text-sm leading-6 text-muted">
            {authEnabled
              ? "Входът не е наличен в момента."
              : "Входът ще бъде наличен съвсем скоро."}
          </div>
        )}

        {feedback ? (
          <div className="mt-3 rounded-[22px] border border-danger/20 bg-danger/5 px-4 py-3 text-sm text-danger">
            {feedback}
          </div>
        ) : null}
      </div>
    </section>
  );
}
