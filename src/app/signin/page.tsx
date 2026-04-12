import { redirect } from "next/navigation";

import { BackgroundHearts } from "@/components/background-hearts";
import { SignInCard } from "@/components/sign-in-card";
import { hasCredentialsAuth, isAuthEnabled } from "@/lib/auth";
import { getOptionalViewer } from "@/lib/viewer";

export const dynamic = "force-dynamic";

export default async function SignInPage() {
  const viewer = await getOptionalViewer();

  if (viewer) {
    redirect("/");
  }

  return (
    <main className="safe-page relative overflow-hidden px-4 text-foreground sm:px-6">
      <div className="absolute inset-x-0 top-0 h-80 bg-[radial-gradient(circle_at_top,rgba(214,86,136,0.22),transparent_58%)]" />
      <BackgroundHearts />
      <div className="relative mx-auto flex min-h-[calc(100dvh-3rem)] max-w-6xl items-center justify-center">
        <SignInCard
          credentialsEnabled={hasCredentialsAuth()}
          authEnabled={isAuthEnabled()}
        />
      </div>
    </main>
  );
}
