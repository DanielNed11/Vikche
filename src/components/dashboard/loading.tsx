import type { ReactNode } from "react";

export function LoadingLabel({
  isPending,
  idle,
  loading,
}: {
  isPending: boolean;
  idle: ReactNode;
  loading: ReactNode;
}) {
  if (!isPending) {
    return <>{idle}</>;
  }

  return (
    <span className="inline-flex items-center gap-2">
      <span className="h-2 w-2 animate-pulse rounded-full bg-current" />
      <span>{loading}</span>
    </span>
  );
}
