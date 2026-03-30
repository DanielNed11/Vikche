import { redirect } from "next/navigation";

import { SignInCard } from "@/components/sign-in-card";
import { getAuthProviderAvailability, isAuthEnabled } from "@/lib/auth";
import { getOptionalViewer } from "@/lib/viewer";

export const dynamic = "force-dynamic";

export default async function SignInPage() {
  const viewer = await getOptionalViewer();

  if (viewer) {
    redirect("/");
  }

  const providerAvailability = getAuthProviderAvailability();

  return (
    <main className="relative min-h-screen overflow-hidden px-4 py-6 text-foreground sm:px-6 sm:py-8">
      <div className="absolute inset-x-0 top-0 h-80 bg-[radial-gradient(circle_at_top,rgba(214,86,136,0.22),transparent_58%)]" />
      <div className="relative mx-auto flex min-h-[calc(100vh-3rem)] max-w-6xl items-center justify-center">
        <SignInCard
          googleEnabled={providerAvailability.google}
          appleEnabled={providerAvailability.apple}
          authEnabled={isAuthEnabled()}
        />
      </div>
    </main>
  );
}
