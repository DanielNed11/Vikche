import { BackgroundHearts } from "@/components/background-hearts";
import { VikcheDashboard } from "@/components/dashboard/vikche-dashboard";
import { getDashboardData } from "@/lib/watch-service";
import { getOptionalViewer } from "@/lib/viewer";
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

export default async function Home() {
  const viewer = await getOptionalViewer();

  if (!viewer) {
    redirect("/signin");
  }

  let dashboard = null;

  try {
    dashboard = await getDashboardData(viewer.id);
  } catch {
    dashboard = null;
  }

  if (!dashboard) {
    return (
      <main className="safe-page relative overflow-hidden px-4 text-foreground sm:px-6 lg:px-10">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(214,86,136,0.18),transparent_34%),radial-gradient(circle_at_bottom_right,rgba(240,139,176,0.12),transparent_26%)]" />
        <BackgroundHearts />
        <div className="relative mx-auto flex min-h-[70vh] w-full max-w-3xl flex-col items-center justify-center text-center">
          <h1 className="font-brand text-[5.7rem] leading-[0.8] tracking-[0.01em] text-accent-strong sm:text-[8.25rem]">
            Vikche
          </h1>
          <div className="mt-8 w-full rounded-[32px] border border-white/75 bg-white/82 px-6 py-8 shadow-[0_28px_70px_rgba(138,45,86,0.12)] backdrop-blur-sm">
            <h2 className="text-2xl font-semibold text-accent-strong">
              В момента не можем да заредим списъка ти
            </h2>
            <p className="mt-3 text-base leading-7 text-muted">
              Опитай пак след малко.
            </p>
          </div>
        </div>
      </main>
    );
  }

  return (
    <VikcheDashboard
      initialData={dashboard}
      viewer={{
        name: viewer.name,
        email: viewer.email,
      }}
    />
  );
}
