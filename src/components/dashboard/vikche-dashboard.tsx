"use client";

import { signOut } from "next-auth/react";
import type { DashboardData } from "@/lib/types";

import { BackgroundHearts } from "@/components/background-hearts";
import { ChooseShade } from "./choose-shade";
import { DashboardProvider } from "./dashboard-context";
import { HeartLoaderModal } from "./loading";
import { ProductList } from "./product-list";
import { Search } from "./search";

export function VikcheDashboard({
  initialData,
  viewer,
}: {
  initialData: DashboardData;
  viewer: {
    name: string | null;
    email: string | null;
  };
}) {
  return (
    <DashboardProvider initialData={initialData}>
      <main className="safe-page relative overflow-hidden px-4 text-foreground sm:px-6 lg:px-10">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(214,86,136,0.18),transparent_34%),radial-gradient(circle_at_bottom_right,rgba(240,139,176,0.12),transparent_26%)]" />
        <BackgroundHearts />
        <HeartLoaderModal />
        <div className="relative mx-auto flex w-full max-w-6xl flex-col">
          <div className="flex justify-end">
            <div className="inline-flex items-center gap-3 rounded-full border border-white/70 bg-white/72 px-3 py-2 text-sm shadow-[0_16px_40px_rgba(138,45,86,0.08)] backdrop-blur-sm">
              <span className="hidden max-w-[15rem] truncate text-muted sm:inline">
                {viewer.name ?? viewer.email ?? "Vikche"}
              </span>
              <button
                type="button"
                onClick={() => {
                  void signOut({ callbackUrl: "/signin" });
                }}
                className="rounded-full px-3 py-1 font-semibold text-accent-strong transition hover:bg-accent-soft"
              >
                Изход
              </button>
            </div>
          </div>

          <Search />
          <ChooseShade />
          <ProductList />
        </div>
      </main>
    </DashboardProvider>
  );
}
