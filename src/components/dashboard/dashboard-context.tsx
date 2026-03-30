"use client";

import {
  createContext,
  useContext,
  useMemo,
  useState,
  useTransition,
  type FormEvent,
  type ReactNode,
} from "react";

import type {
  CreateWatchResult,
  DashboardData,
  ResolveDouglasResult,
  ResolvedConfigurableProduct,
  WatchMutationResult,
  WatchView,
} from "@/lib/types";

import { buildWatchGroups, type WatchGroup } from "./helpers";

type PendingSelection = {
  url: string;
  resolved: ResolvedConfigurableProduct;
  selectedVariantCodes: string[];
};

type DashboardContextValue = {
  dashboard: DashboardData;
  watchGroups: WatchGroup[];
  url: string;
  feedback: string | null;
  pendingSelection: PendingSelection | null;
  selectedVariants: ResolvedConfigurableProduct["variants"];
  isPending: boolean;
  handleUrlChange: (value: string) => void;
  handleSubmit: (event: FormEvent<HTMLFormElement>) => void;
  handleToggleVariant: (variantCode: string) => void;
  handleSaveSelectedVariants: () => void;
  handleRefresh: (watchId: string) => void;
  isGroupExpanded: (group: WatchGroup) => boolean;
  toggleGroup: (group: WatchGroup) => void;
};

const DashboardContext = createContext<DashboardContextValue | undefined>(undefined);

export function DashboardProvider({
  initialData,
  children,
}: {
  initialData: DashboardData;
  children: ReactNode;
}) {
  const [dashboard, setDashboard] = useState(initialData);
  const [url, setUrl] = useState("");
  const [feedback, setFeedback] = useState<string | null>(null);
  const [expandedGroups, setExpandedGroups] = useState<Record<string, boolean>>({});
  const [pendingSelection, setPendingSelection] = useState<PendingSelection | null>(
    null,
  );
  const [isPending, startTransition] = useTransition();

  async function loadDashboard() {
    const response = await fetch("/api/watchlist/items", {
      cache: "no-store",
    });
    const payload = (await response.json()) as DashboardData & { error?: string };

    if (!response.ok) {
      throw new Error(payload.error ?? "Не успяхме да заредим списъка.");
    }

    setDashboard(payload);
  }

  function upsertWatch(updatedWatch: WatchView) {
    setDashboard((current) => {
      const watches = current.watches.some((watch) => watch.id === updatedWatch.id)
        ? current.watches.map((watch) =>
            watch.id === updatedWatch.id ? updatedWatch : watch,
          )
        : [updatedWatch, ...current.watches];

      return {
        ...current,
        watches,
      };
    });
  }

  async function createWatchRequest(urlToSave: string, variantCode?: string) {
    const response = await fetch("/api/watchlist/items", {
      method: "POST",
      headers: {
        "content-type": "application/json",
      },
      body: JSON.stringify({ url: urlToSave, variantCode }),
    });
    const payload = (await response.json()) as CreateWatchResult & { error?: string };

    if (!response.ok) {
      throw new Error(payload.error ?? "Не успяхме да добавим този Douglas линк.");
    }

    return payload;
  }

  async function persistWatch(urlToSave: string, variantCode?: string) {
    const payload = await createWatchRequest(urlToSave, variantCode);

    upsertWatch(payload.watch);
    setPendingSelection(null);
    setUrl("");
    setFeedback(
      payload.duplicate
        ? "Този вариант вече е в списъка."
        : payload.error
          ? "Продуктът е добавен, но първата проверка не успя."
          : "Продуктът е добавен успешно.",
    );
    await loadDashboard();
  }

  function handleUrlChange(value: string) {
    setUrl(value);

    if (pendingSelection && value.trim() !== pendingSelection.url) {
      setPendingSelection(null);
    }
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFeedback(null);

    startTransition(async () => {
      try {
        const response = await fetch("/api/watchlist/resolve", {
          method: "POST",
          headers: {
            "content-type": "application/json",
          },
          body: JSON.stringify({ url }),
        });
        const payload = (await response.json()) as ResolveDouglasResult & {
          error?: string;
        };

        if (!response.ok) {
          throw new Error(payload.error ?? "Не успяхме да добавим този Douglas линк.");
        }

        if (payload.resolved.kind === "configurable") {
          setPendingSelection({
            url: payload.resolved.canonicalUrl,
            resolved: payload.resolved,
            selectedVariantCodes: [],
          });
          setUrl(payload.resolved.canonicalUrl);
          setFeedback("Избери един или повече нюанси, преди да запазиш продукта.");
          return;
        }

        await persistWatch(payload.resolved.canonicalUrl);
      } catch (error) {
        setFeedback(error instanceof Error ? error.message : "Нещо се обърка. Опитай отново.");
      }
    });
  }

  function handleToggleVariant(variantCode: string) {
    setPendingSelection((current) =>
      current
        ? {
            ...current,
            selectedVariantCodes: current.selectedVariantCodes.includes(variantCode)
              ? current.selectedVariantCodes.filter((code) => code !== variantCode)
              : [...current.selectedVariantCodes, variantCode],
          }
        : current,
    );
  }

  function handleSaveSelectedVariants() {
    const selectedVariantCodes = pendingSelection?.selectedVariantCodes ?? [];

    if (!pendingSelection || selectedVariantCodes.length === 0) {
      setFeedback("Избери поне един нюанс.");
      return;
    }

    setFeedback(null);

    startTransition(async () => {
      const createdCodes: string[] = [];
      const duplicateCodes: string[] = [];
      const scrapeFailureCodes: string[] = [];
      const requestFailures: string[] = [];

      try {
        for (const selectedVariantCode of selectedVariantCodes) {
          try {
            const payload = await createWatchRequest(
              pendingSelection.url,
              selectedVariantCode,
            );

            upsertWatch(payload.watch);

            if (payload.duplicate) {
              duplicateCodes.push(selectedVariantCode);
            } else {
              createdCodes.push(selectedVariantCode);
            }

            if (payload.error) {
              scrapeFailureCodes.push(selectedVariantCode);
            }
          } catch {
            requestFailures.push(`${selectedVariantCode}: неуспешно добавяне.`);
          }
        }

        if (createdCodes.length > 0 || duplicateCodes.length > 0) {
          setPendingSelection(null);
          setUrl("");
          await loadDashboard();
        }

        const feedbackParts: string[] = [];

        if (createdCodes.length > 0) {
          feedbackParts.push(
            createdCodes.length === 1
              ? "1 нюанс е добавен."
              : `${createdCodes.length} нюанса са добавени.`,
          );
        }

        if (duplicateCodes.length > 0) {
          feedbackParts.push(
            duplicateCodes.length === 1
              ? "1 нюанс вече е в списъка."
              : `${duplicateCodes.length} нюанса вече са в списъка.`,
          );
        }

        if (scrapeFailureCodes.length > 0) {
          feedbackParts.push(
            scrapeFailureCodes.length === 1
              ? "За 1 нюанс първата проверка не успя."
              : `За ${scrapeFailureCodes.length} нюанса първата проверка не успя.`,
          );
        }

        if (requestFailures.length > 0) {
          feedbackParts.push(requestFailures.join(" "));
        }

        setFeedback(feedbackParts.join(" ") || "Не беше добавен нов нюанс.");
      } catch (error) {
        setFeedback(error instanceof Error ? error.message : "Нещо се обърка. Опитай отново.");
      }
    });
  }

  function handleRefresh(id: string) {
    setFeedback(null);

    startTransition(async () => {
      try {
        const response = await fetch(`/api/watchlist/items/${id}/refresh`, {
          method: "POST",
        });
        const payload = (await response.json()) as WatchMutationResult & { error?: string };

        if (!response.ok) {
          throw new Error(payload.error ?? "Не успяхме да обновим продукта.");
        }

        upsertWatch(payload.watch);
        setFeedback(
          payload.error
            ? "Не успяхме да обновим този продукт в момента."
            : "Продуктът е обновен.",
        );
        await loadDashboard();
      } catch (error) {
        setFeedback(error instanceof Error ? error.message : "Не успяхме да обновим продукта.");
      }
    });
  }

  const selectedVariants =
    pendingSelection?.resolved.variants.filter((variant) =>
      pendingSelection.selectedVariantCodes.includes(variant.variantCode),
    ) ?? [];
  const watchGroups = useMemo(
    () => buildWatchGroups(dashboard.watches),
    [dashboard.watches],
  );

  function isGroupExpanded(group: WatchGroup) {
    return expandedGroups[group.key] ?? group.watches.length === 1;
  }

  function toggleGroup(group: WatchGroup) {
    setExpandedGroups((current) => ({
      ...current,
      [group.key]: !(current[group.key] ?? group.watches.length === 1),
    }));
  }

  const value: DashboardContextValue = {
    dashboard,
    watchGroups,
    url,
    feedback,
    pendingSelection,
    selectedVariants,
    isPending,
    handleUrlChange,
    handleSubmit,
    handleToggleVariant,
    handleSaveSelectedVariants,
    handleRefresh,
    isGroupExpanded,
    toggleGroup,
  };

  return (
    <DashboardContext.Provider value={value}>{children}</DashboardContext.Provider>
  );
}

export function useDashboard() {
  const context = useContext(DashboardContext);

  if (!context) {
    throw new Error("useDashboard must be used within DashboardProvider");
  }

  return context;
}
