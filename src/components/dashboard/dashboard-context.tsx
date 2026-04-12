"use client";

import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  useTransition,
  type FormEventHandler,
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

export type DashboardActivityAction = "add_product" | "refresh_product";
export type DashboardActivityPhase =
  | "idle"
  | "opening_page"
  | "reading_product"
  | "saving_product"
  | "refreshing_list"
  | "error";

export type DashboardActivityStatus = {
  action: DashboardActivityAction | null;
  phase: DashboardActivityPhase;
  helper: string | null;
  error: string | null;
  targetLabel: string | null;
};

type DashboardContextValue = {
  dashboard: DashboardData;
  watchGroups: WatchGroup[];
  url: string;
  feedback: string | null;
  activityStatus: DashboardActivityStatus;
  pendingSelection: PendingSelection | null;
  selectedVariants: ResolvedConfigurableProduct["variants"];
  isPending: boolean;
  isBusy: boolean;
  handleUrlChange: (value: string) => void;
  handleSubmit: FormEventHandler<HTMLFormElement>;
  handleRetrySubmit: () => void;
  handleDismissActivity: () => void;
  handleToggleVariant: (variantCode: string) => void;
  handleSaveSelectedVariants: () => void;
  handleRefresh: (watchId: string) => void;
  handleRemove: (watchId: string) => void;
  isGroupExpanded: (group: WatchGroup) => boolean;
  toggleGroup: (group: WatchGroup) => void;
};

const DashboardContext = createContext<DashboardContextValue | undefined>(undefined);

function createIdleActivityStatus(): DashboardActivityStatus {
  return {
    action: null,
    phase: "idle",
    helper: null,
    error: null,
    targetLabel: null,
  };
}

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
  const [activityStatus, setActivityStatus] = useState<DashboardActivityStatus>(
    createIdleActivityStatus(),
  );
  const [expandedGroups, setExpandedGroups] = useState<Record<string, boolean>>({});
  const [pendingSelection, setPendingSelection] = useState<PendingSelection | null>(
    null,
  );
  const [isPending, startTransition] = useTransition();
  const latestRequestIdRef = useRef(0);

  useEffect(() => {
    if (
      activityStatus.phase !== "opening_page" &&
      activityStatus.phase !== "reading_product"
    ) {
      return;
    }

    const readingTimer =
      activityStatus.phase === "opening_page"
        ? window.setTimeout(() => {
            setActivityStatus((current) =>
              current.phase === "opening_page"
                ? { ...current, phase: "reading_product", helper: null, error: null }
                : current,
            );
          }, 1200)
        : null;

    const helperTimer = window.setTimeout(() => {
      setActivityStatus((current) =>
        current.phase === "opening_page" || current.phase === "reading_product"
          ? {
              ...current,
              helper: "Понякога това отнема още няколко секунди.",
            }
          : current,
      );
    }, activityStatus.phase === "opening_page" ? 3200 : 2000);

    return () => {
      if (readingTimer) {
        window.clearTimeout(readingTimer);
      }

      window.clearTimeout(helperTimer);
    };
  }, [activityStatus.phase]);

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

  function removeWatch(id: string) {
    setDashboard((current) => ({
      ...current,
      watches: current.watches.filter((watch) => watch.id !== id),
    }));
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
      throw new Error(payload.error ?? "Не успяхме да добавим продукта.");
    }

    return payload;
  }

  function startActivity(action: DashboardActivityAction, targetLabel?: string | null) {
    setActivityStatus({
      action,
      phase: "opening_page",
      helper: null,
      error: null,
      targetLabel: targetLabel?.trim() || null,
    });
  }

  function resetActivityStatus() {
    setActivityStatus(createIdleActivityStatus());
  }

  function setActivityPhase(
    requestId: number,
    phase: Exclude<DashboardActivityPhase, "idle" | "error">,
  ) {
    if (!isActiveRequest(requestId)) {
      return;
    }

    setActivityStatus((current) => ({
      ...current,
      phase,
      helper: null,
      error: null,
    }));
  }

  function setActivityError(requestId: number, message: string) {
    if (!isActiveRequest(requestId)) {
      return;
    }

    setActivityStatus((current) => ({
      ...current,
      phase: "error",
      helper: null,
      error: message,
    }));
  }

  function handleDismissActivity() {
    if (activityStatus.phase === "error") {
      resetActivityStatus();
    }
  }

  function isActiveRequest(requestId: number) {
    return latestRequestIdRef.current === requestId;
  }

  function nextRequestId() {
    const requestId = latestRequestIdRef.current + 1;
    latestRequestIdRef.current = requestId;
    return requestId;
  }

  async function persistWatch(
    urlToSave: string,
    variantCode: string | undefined,
    requestId: number,
  ) {
    if (!isActiveRequest(requestId)) {
      return;
    }

    setActivityPhase(requestId, "saving_product");
    const payload = await createWatchRequest(urlToSave, variantCode);

    if (!isActiveRequest(requestId)) {
      return;
    }

    upsertWatch(payload.watch);
    setPendingSelection(null);
    setUrl("");
    setFeedback(
      payload.duplicate
        ? "Този вариант вече е в списъка."
        : payload.error
          ? "Продуктът е добавен. Ще покажем цената съвсем скоро."
          : "Продуктът е добавен успешно.",
    );

    try {
      setActivityPhase(requestId, "refreshing_list");
      await loadDashboard();
    } catch {
      if (!isActiveRequest(requestId)) {
        return;
      }

      setFeedback("Продуктът е добавен. Списъкът ще се обнови след малко.");
    } finally {
      if (isActiveRequest(requestId)) {
        resetActivityStatus();
      }
    }
  }

  async function submitProductUrl(rawUrl: string) {
    const nextUrl = rawUrl.trim();

    if (!nextUrl) {
      setFeedback("Постави линк към продукт, за да продължим.");
      return;
    }

    if (activityStatus.phase !== "idle" && activityStatus.phase !== "error") {
      return;
    }

    const requestId = nextRequestId();
    setFeedback(null);
    startActivity("add_product");

    try {
      const response = await fetch("/api/watchlist/resolve", {
        method: "POST",
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify({ url: nextUrl }),
      });
      const payload = (await response.json()) as ResolveDouglasResult & {
        error?: string;
      };

      if (!response.ok) {
        throw new Error(payload.error ?? "Не успяхме да добавим продукта.");
      }

      if (!isActiveRequest(requestId)) {
        return;
      }

      if (payload.resolved.kind === "configurable") {
        resetActivityStatus();
        setPendingSelection({
          url: payload.resolved.canonicalUrl,
          resolved: payload.resolved,
          selectedVariantCodes: [],
        });
        setUrl(payload.resolved.canonicalUrl);
        setFeedback("Избери един или повече варианти, преди да запазиш продукта.");
        return;
      }

      await persistWatch(payload.resolved.canonicalUrl, undefined, requestId);
    } catch (error) {
      setActivityError(
        requestId,
        error instanceof Error ? error.message : "Нещо се обърка. Опитай отново.",
      );
    }
  }

  function handleUrlChange(value: string) {
    setUrl(value);

    if (pendingSelection && value.trim() !== pendingSelection.url) {
      setPendingSelection(null);
    }
  }

  const handleSubmit: FormEventHandler<HTMLFormElement> = (event) => {
    event.preventDefault();
    void submitProductUrl(url);
  };

  function handleRetrySubmit() {
    if (
      activityStatus.phase !== "error" ||
      activityStatus.action !== "add_product"
    ) {
      return;
    }

    void submitProductUrl(url);
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
      setFeedback("Избери поне един вариант.");
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
              ? "1 вариант е добавен."
              : `${createdCodes.length} варианта са добавени.`,
          );
        }

        if (duplicateCodes.length > 0) {
          feedbackParts.push(
            duplicateCodes.length === 1
              ? "1 вариант вече е в списъка."
              : `${duplicateCodes.length} варианта вече са в списъка.`,
          );
        }

        if (scrapeFailureCodes.length > 0) {
          feedbackParts.push(
            scrapeFailureCodes.length === 1
              ? "За 1 вариант ще покажем цената след малко."
              : `За ${scrapeFailureCodes.length} варианта ще покажем цената след малко.`,
          );
        }

        if (requestFailures.length > 0) {
          feedbackParts.push(requestFailures.join(" "));
        }

        setFeedback(feedbackParts.join(" ") || "Не беше добавен нов вариант.");
      } catch (error) {
        setFeedback(error instanceof Error ? error.message : "Нещо се обърка. Опитай отново.");
      }
    });
  }

  function handleRefresh(id: string) {
    if (activityStatus.phase !== "idle") {
      return;
    }

    const watch = dashboard.watches.find((currentWatch) => currentWatch.id === id) ?? null;
    const requestId = nextRequestId();
    setFeedback(null);
    startActivity("refresh_product", watch?.title ?? null);

    startTransition(async () => {
      try {
        const response = await fetch(`/api/watchlist/items/${id}/refresh`, {
          method: "POST",
        });
        const payload = (await response.json()) as WatchMutationResult & { error?: string };

        if (!response.ok) {
          throw new Error(payload.error ?? "Не успяхме да опресним продукта.");
        }

        if (!isActiveRequest(requestId)) {
          return;
        }

        setActivityPhase(requestId, "saving_product");
        upsertWatch(payload.watch);
        setFeedback(
          payload.error
            ? "Ще опитаме отново след малко."
            : "Продуктът е опреснен.",
        );

        try {
          setActivityPhase(requestId, "refreshing_list");
          await loadDashboard();
        } catch {
          if (!isActiveRequest(requestId)) {
            return;
          }

          setFeedback("Продуктът е обновен. Списъкът ще се обнови след малко.");
        } finally {
          if (isActiveRequest(requestId)) {
            resetActivityStatus();
          }
        }
      } catch (error) {
        const message =
          error instanceof Error ? error.message : "Не успяхме да опресним продукта.";
        setFeedback(message);
        setActivityError(requestId, message);
      }
    });
  }

  function handleRemove(id: string) {
    setFeedback(null);

    startTransition(async () => {
      try {
        const response = await fetch(`/api/watchlist/items/${id}`, {
          method: "DELETE",
        });
        const payload = (await response.json()) as { error?: string };

        if (!response.ok) {
          throw new Error(payload.error ?? "Не успяхме да премахнем продукта.");
        }

        removeWatch(id);
        setFeedback("Продуктът е премахнат.");
        await loadDashboard();
      } catch (error) {
        setFeedback(
          error instanceof Error ? error.message : "Не успяхме да премахнем продукта.",
        );
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
    activityStatus,
    pendingSelection,
    selectedVariants,
    isPending,
    isBusy: activityStatus.phase !== "idle",
    handleUrlChange,
    handleSubmit,
    handleRetrySubmit,
    handleDismissActivity,
    handleToggleVariant,
    handleSaveSelectedVariants,
    handleRefresh,
    handleRemove,
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
