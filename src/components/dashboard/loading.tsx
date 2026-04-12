import type { ReactNode } from "react";

import { useDashboard, type DashboardActivityStatus } from "./dashboard-context";

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

function actionLabel(status: DashboardActivityStatus) {
  if (status.action === "refresh_product") {
    return "Обновяваме продукта";
  }

  return "Добавяме продукта";
}

function phaseTitle(status: DashboardActivityStatus) {
  if (status.phase === "error") {
    return "Нещо ни спря.";
  }

  if (status.action === "refresh_product") {
    switch (status.phase) {
      case "opening_page":
        return "Отваряме страницата...";
      case "reading_product":
        return "Подготвяме продукта...";
      case "saving_product":
        return "Обновяваме цената...";
      case "refreshing_list":
        return "Обновяваме списъка...";
      default:
        return "";
    }
  }

  switch (status.phase) {
    case "opening_page":
      return "Отваряме страницата...";
    case "reading_product":
      return "Подготвяме продукта...";
    case "saving_product":
      return "Запазваме го във Vikche...";
    case "refreshing_list":
      return "Обновяваме списъка...";
    default:
      return "";
  }
}

function phaseBody(status: DashboardActivityStatus) {
  if (status.helper) {
    return status.helper;
  }

  if (status.phase === "error") {
    return status.error ?? "Нещо се обърка. Опитай отново.";
  }

  if (status.action === "refresh_product") {
    switch (status.phase) {
      case "opening_page":
        return "Отваряме страницата и подготвяме проверката.";
      case "reading_product":
        return "Проверяваме последната цена, наличност и отстъпки.";
      case "saving_product":
        return "Записваме новата информация за продукта.";
      case "refreshing_list":
        return "Показваме обновените данни в твоя списък.";
      default:
        return "";
    }
  }

  switch (status.phase) {
    case "opening_page":
      return "Проверяваме линка и подготвяме страницата.";
    case "reading_product":
      return "Събираме най-важното, за да покажем правилния продукт.";
    case "saving_product":
      return "Остава съвсем малко, за да го добавим към списъка.";
    case "refreshing_list":
      return "Показваме го в твоя списък с проследявани продукти.";
    default:
      return "";
  }
}

function progressForPhase(status: DashboardActivityStatus) {
  switch (status.phase) {
    case "opening_page":
      return 0.25;
    case "reading_product":
      return 0.55;
    case "saving_product":
      return 0.8;
    case "refreshing_list":
      return 1;
    case "error":
      return 0.78;
    default:
      return 0;
  }
}

function buildWavePath({
  topY,
  amplitude,
  wavelength,
  phaseOffset,
}: {
  topY: number;
  amplitude: number;
  wavelength: number;
  phaseOffset: number;
}) {
  const startX = -96;
  const endX = 352;
  let path = `M ${startX} ${topY + phaseOffset}`;

  for (let x = startX; x < endX; x += wavelength) {
    const half = wavelength / 2;
    path += ` C ${x + wavelength * 0.25} ${topY - amplitude + phaseOffset}, ${
      x + wavelength * 0.25
    } ${topY - amplitude + phaseOffset}, ${x + half} ${topY + phaseOffset}`;
    path += ` S ${x + wavelength * 0.75} ${topY + amplitude + phaseOffset}, ${
      x + wavelength
    } ${topY + phaseOffset}`;
  }

  path += ` V 256 H ${startX} Z`;
  return path;
}

function HeartGraphic({ status }: { status: DashboardActivityStatus }) {
  const isError = status.phase === "error";
  const progress = progressForPhase(status);
  const fillHeight = 256 * progress;
  const fillY = 256 - fillHeight;
  const liquidTop = Math.max(42, fillY + 6);
  const bubbleBaseY = Math.min(214, liquidTop + 66);
  const heartPath =
    "M128 224S38.4 170.7 18.7 108.8C4.2 63.3 31.4 24 72.3 24c25.8 0 48.2 15.3 55.7 39.1C135.5 39.3 157.9 24 183.7 24c40.9 0 68.1 39.3 53.6 84.8C217.6 170.7 128 224 128 224Z";
  const backWavePath = buildWavePath({
    topY: liquidTop + 10,
    amplitude: 8,
    wavelength: 96,
    phaseOffset: 0,
  });
  const frontWavePath = buildWavePath({
    topY: liquidTop,
    amplitude: 12,
    wavelength: 82,
    phaseOffset: 0,
  });
  const shimmerWavePath = buildWavePath({
    topY: liquidTop - 4,
    amplitude: 6,
    wavelength: 108,
    phaseOffset: 0,
  });

  if (isError) {
    const crackPath = "M132 34 L121 68 L144 110 L118 148 L138 224";
    const leftClipPoints = "0,0 132,34 121,68 144,110 118,148 138,256 0,256";
    const rightClipPoints = "132,34 121,68 144,110 118,148 138,256 256,256 256,0";
    const diagonalOffsets = [-180, -144, -108, -72, -36, 0, 36, 72, 108, 144];

    return (
      <svg
        viewBox="0 0 256 256"
        className="h-44 w-44 drop-shadow-[0_18px_28px_rgba(214,86,136,0.18)] sm:h-52 sm:w-52"
        aria-hidden="true"
      >
        <defs>
          <linearGradient id="vikche-heart-error-gradient" x1="0%" x2="0%" y1="0%" y2="100%">
            <stop offset="0%" stopColor="#f7c6d8" />
            <stop offset="52%" stopColor="#e38caf" />
            <stop offset="100%" stopColor="#cf6d93" />
          </linearGradient>
          <linearGradient id="vikche-heart-error-gloss" x1="0%" x2="0%" y1="0%" y2="100%">
            <stop offset="0%" stopColor="#ffffff" stopOpacity="0.72" />
            <stop offset="100%" stopColor="#ffffff" stopOpacity="0" />
          </linearGradient>
          <clipPath id="vikche-heart-error-shape">
            <path d={heartPath} />
          </clipPath>
          <clipPath id="vikche-heart-error-left">
            <polygon points={leftClipPoints} />
          </clipPath>
          <clipPath id="vikche-heart-error-right">
            <polygon points={rightClipPoints} />
          </clipPath>
        </defs>

        <path d={heartPath} fill="#fff4f8" />

        <g clipPath="url(#vikche-heart-error-shape)">
          <g clipPath="url(#vikche-heart-error-left)">
            <g transform="translate(-2 1)">
              <animateTransform
                attributeName="transform"
                type="translate"
                values="-2 1;-5 3;-3.5 2.2;-2 1"
                keyTimes="0;0.34;0.7;1"
                calcMode="spline"
                keySplines="0.42 0 0.58 1;0.42 0 0.58 1;0.42 0 0.58 1"
                dur="2.8s"
                repeatCount="indefinite"
              />
              <path d={heartPath} fill="url(#vikche-heart-error-gradient)" />
              <path
                d="M70 62 C 95 40, 150 40, 184 62 L 184 78 C 150 58, 98 60, 70 80 Z"
                fill="url(#vikche-heart-error-gloss)"
                opacity="0.28"
              />
              <g opacity="0.18">
                {diagonalOffsets.map((offset) => (
                  <path
                    key={`diag-left-a-${offset}`}
                    d={`M ${offset} 252 L ${offset + 220} 32`}
                    fill="none"
                    stroke="#ffffff"
                    strokeWidth="6"
                    strokeLinecap="round"
                  />
                ))}
                {diagonalOffsets.map((offset) => (
                  <path
                    key={`diag-left-b-${offset}`}
                    d={`M ${offset + 220} 252 L ${offset} 32`}
                    fill="none"
                    stroke="#ffffff"
                    strokeWidth="4"
                    strokeLinecap="round"
                    opacity="0.72"
                  />
                ))}
              </g>
            </g>
          </g>

          <g clipPath="url(#vikche-heart-error-right)">
            <g transform="translate(2 1)">
              <animateTransform
                attributeName="transform"
                type="translate"
                values="2 1;5.5 3;3.8 2.2;2 1"
                keyTimes="0;0.34;0.7;1"
                calcMode="spline"
                keySplines="0.42 0 0.58 1;0.42 0 0.58 1;0.42 0 0.58 1"
                dur="2.8s"
                repeatCount="indefinite"
              />
              <path d={heartPath} fill="url(#vikche-heart-error-gradient)" />
              <path
                d="M70 62 C 95 40, 150 40, 184 62 L 184 78 C 150 58, 98 60, 70 80 Z"
                fill="url(#vikche-heart-error-gloss)"
                opacity="0.24"
              />
              <g opacity="0.18">
                {diagonalOffsets.map((offset) => (
                  <path
                    key={`diag-right-a-${offset}`}
                    d={`M ${offset} 252 L ${offset + 220} 32`}
                    fill="none"
                    stroke="#ffffff"
                    strokeWidth="6"
                    strokeLinecap="round"
                  />
                ))}
                {diagonalOffsets.map((offset) => (
                  <path
                    key={`diag-right-b-${offset}`}
                    d={`M ${offset + 220} 252 L ${offset} 32`}
                    fill="none"
                    stroke="#ffffff"
                    strokeWidth="4"
                    strokeLinecap="round"
                    opacity="0.72"
                  />
                ))}
              </g>
            </g>
          </g>
        </g>

        <g clipPath="url(#vikche-heart-error-left)">
          <path d={heartPath} fill="none" stroke="#d65688" strokeWidth="10" strokeLinejoin="round">
            <animateTransform
              attributeName="transform"
              type="translate"
              values="-2 1;-5 3;-3.5 2.2;-2 1"
              keyTimes="0;0.34;0.7;1"
              calcMode="spline"
              keySplines="0.42 0 0.58 1;0.42 0 0.58 1;0.42 0 0.58 1"
              dur="2.8s"
              repeatCount="indefinite"
            />
          </path>
        </g>

        <g clipPath="url(#vikche-heart-error-right)">
          <path d={heartPath} fill="none" stroke="#d65688" strokeWidth="10" strokeLinejoin="round">
            <animateTransform
              attributeName="transform"
              type="translate"
              values="2 1;5.5 3;3.8 2.2;2 1"
              keyTimes="0;0.34;0.7;1"
              calcMode="spline"
              keySplines="0.42 0 0.58 1;0.42 0 0.58 1;0.42 0 0.58 1"
              dur="2.8s"
              repeatCount="indefinite"
            />
          </path>
        </g>

        <path
          d={crackPath}
          fill="none"
          stroke="#ffffff"
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth="9"
          strokeDasharray="220 220"
          strokeDashoffset="220"
        >
          <animate
            attributeName="stroke-dashoffset"
            values="220;0;0"
            keyTimes="0;0.38;1"
            calcMode="spline"
            keySplines="0.42 0 0.58 1;0 0 1 1"
            dur="2.8s"
            repeatCount="indefinite"
          />
        </path>
        <path
          d={crackPath}
          fill="none"
          stroke="#f8e6ee"
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth="3"
          strokeDasharray="220 220"
          strokeDashoffset="220"
        >
          <animate
            attributeName="stroke-dashoffset"
            values="220;0;0"
            keyTimes="0;0.38;1"
            calcMode="spline"
            keySplines="0.42 0 0.58 1;0 0 1 1"
            dur="2.8s"
            repeatCount="indefinite"
          />
        </path>
      </svg>
    );
  }

  return (
    <svg
      viewBox="0 0 256 256"
      className="h-44 w-44 drop-shadow-[0_18px_28px_rgba(214,86,136,0.18)] sm:h-52 sm:w-52"
      aria-hidden="true"
    >
      <defs>
        <linearGradient id="vikche-heart-gradient" x1="0%" x2="0%" y1="0%" y2="100%">
          <stop offset="0%" stopColor="#ffc1d8" />
          <stop offset="52%" stopColor="#ef7ea8" />
          <stop offset="100%" stopColor="#d65688" />
        </linearGradient>
        <linearGradient id="vikche-heart-wave-front" x1="0%" x2="100%" y1="0%" y2="0%">
          <stop offset="0%" stopColor="#f9a9c6" />
          <stop offset="50%" stopColor="#ef7ea8" />
          <stop offset="100%" stopColor="#d65688" />
        </linearGradient>
        <linearGradient id="vikche-heart-wave-back" x1="0%" x2="100%" y1="0%" y2="0%">
          <stop offset="0%" stopColor="#ffe0ea" />
          <stop offset="100%" stopColor="#f5b6cd" />
        </linearGradient>
        <linearGradient id="vikche-heart-gloss" x1="0%" x2="0%" y1="0%" y2="100%">
          <stop offset="0%" stopColor="#ffffff" stopOpacity="0.78" />
          <stop offset="100%" stopColor="#ffffff" stopOpacity="0" />
        </linearGradient>
        <clipPath id="vikche-heart-shape">
          <path d={heartPath} />
        </clipPath>
      </defs>

      <path d={heartPath} fill="#fff4f8" />
      <g clipPath="url(#vikche-heart-shape)">
        <rect x="0" y={liquidTop + 12} width="256" height={256 - (liquidTop + 12)} fill="url(#vikche-heart-gradient)" />

        <g opacity="0.85">
          <path d={backWavePath} fill="url(#vikche-heart-wave-back)">
            <animateTransform
              attributeName="transform"
              type="translate"
              values="-34 0; 16 0; -34 0"
              keyTimes="0;0.5;1"
              calcMode="spline"
              keySplines="0.42 0 0.58 1;0.42 0 0.58 1"
              dur="6.2s"
              repeatCount="indefinite"
            />
          </path>
        </g>

        <g>
          <path d={frontWavePath} fill="url(#vikche-heart-wave-front)">
            <animateTransform
              attributeName="transform"
              type="translate"
              values="0 0; 26 0; 0 0"
              keyTimes="0;0.5;1"
              calcMode="spline"
              keySplines="0.42 0 0.58 1;0.42 0 0.58 1"
              dur="4.4s"
              repeatCount="indefinite"
            />
          </path>
        </g>

        <g opacity="0.35">
          <path d={shimmerWavePath} fill="url(#vikche-heart-gloss)">
            <animateTransform
              attributeName="transform"
              type="translate"
              values="-18 0; 22 0; -18 0"
              keyTimes="0;0.5;1"
              calcMode="spline"
              keySplines="0.42 0 0.58 1;0.42 0 0.58 1"
              dur="5.1s"
              repeatCount="indefinite"
            />
          </path>
        </g>

        <path
          d={`M72 ${Math.max(52, liquidTop - 10)} C 98 ${Math.max(36, liquidTop - 26)}, 150 ${Math.max(
            34,
            liquidTop - 22,
          )}, 184 ${Math.max(54, liquidTop - 8)} L 184 ${Math.max(
            66,
            liquidTop + 2,
          )} C 152 ${Math.max(50, liquidTop - 10)}, 102 ${Math.max(
            48,
            liquidTop - 8,
          )}, 72 ${Math.max(66, liquidTop + 4)} Z`}
          fill="url(#vikche-heart-gloss)"
          opacity="0.22"
        />

        <circle cx="92" cy={bubbleBaseY} r="5" fill="#ffffff" opacity="0.34">
          <animate
            attributeName="cy"
            values={`${bubbleBaseY};${Math.max(liquidTop + 12, bubbleBaseY - 36)};${Math.max(
              liquidTop + 6,
              bubbleBaseY - 56,
            )}`}
            dur="3.8s"
            repeatCount="indefinite"
          />
          <animate attributeName="opacity" values="0;0.34;0" dur="3.8s" repeatCount="indefinite" />
        </circle>
        <circle cx="146" cy={bubbleBaseY - 18} r="3.5" fill="#ffffff" opacity="0.28">
          <animate
            attributeName="cy"
            values={`${bubbleBaseY - 18};${Math.max(liquidTop + 8, bubbleBaseY - 46)};${Math.max(
              liquidTop + 2,
              bubbleBaseY - 62,
            )}`}
            dur="3.1s"
            begin="0.6s"
            repeatCount="indefinite"
          />
          <animate
            attributeName="opacity"
            values="0;0.28;0"
            dur="3.1s"
            begin="0.6s"
            repeatCount="indefinite"
          />
        </circle>
        <circle cx="122" cy={bubbleBaseY + 10} r="2.5" fill="#ffffff" opacity="0.24">
          <animate
            attributeName="cy"
            values={`${bubbleBaseY + 10};${Math.max(liquidTop + 18, bubbleBaseY - 28)};${Math.max(
              liquidTop + 10,
              bubbleBaseY - 40,
            )}`}
            dur="2.7s"
            begin="1.1s"
            repeatCount="indefinite"
          />
          <animate
            attributeName="opacity"
            values="0;0.24;0"
            dur="2.7s"
            begin="1.1s"
            repeatCount="indefinite"
          />
        </circle>
      </g>
      <path d={heartPath} fill="none" stroke="#d65688" strokeWidth="10" strokeLinejoin="round" />
    </svg>
  );
}

function ModalActions() {
  const { activityStatus, handleDismissActivity, handleRetrySubmit } = useDashboard();

  if (activityStatus.phase !== "error") {
    return null;
  }

  if (activityStatus.action === "add_product") {
    return (
      <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:justify-center">
        <button
          type="button"
          onClick={handleDismissActivity}
          className="min-h-12 rounded-full border border-white/80 bg-white px-5 py-3 text-sm font-semibold text-accent-strong transition hover:border-accent/45 hover:bg-[#fff8fb]"
        >
          Промени линка
        </button>
        <button
          type="button"
          onClick={handleRetrySubmit}
          className="min-h-12 rounded-full bg-accent px-5 py-3 text-sm font-semibold text-white transition hover:bg-accent-strong"
        >
          Опитай пак
        </button>
      </div>
    );
  }

  return (
    <div className="mt-6 flex justify-center">
      <button
        type="button"
        onClick={handleDismissActivity}
        className="min-h-12 rounded-full bg-accent px-5 py-3 text-sm font-semibold text-white transition hover:bg-accent-strong"
      >
        Затвори
      </button>
    </div>
  );
}

export function HeartLoaderModal() {
  const { activityStatus } = useDashboard();

  if (activityStatus.phase === "idle") {
    return null;
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-[rgba(252,245,248,0.72)] px-4 py-6 backdrop-blur-[5px]"
      role="dialog"
      aria-modal="true"
      aria-live="polite"
    >
      <div className="w-full max-w-md rounded-[36px] border border-white/80 bg-white/90 px-6 py-7 text-center shadow-[0_34px_90px_rgba(138,45,86,0.18)] sm:px-8 sm:py-9">
        <div className="flex justify-center">
          <HeartGraphic status={activityStatus} />
        </div>

        <p className="mt-5 text-[11px] uppercase tracking-[0.28em] text-muted">
          {actionLabel(activityStatus)}
        </p>
        <p className="mt-3 text-2xl font-semibold text-accent-strong">
          {phaseTitle(activityStatus)}
        </p>
        <p className="mt-3 text-sm leading-7 text-muted">
          {phaseBody(activityStatus)}
        </p>

        {activityStatus.targetLabel ? (
          <p className="mt-4 rounded-full bg-[#fff8fb] px-4 py-2 text-sm font-medium text-accent-strong">
            {activityStatus.targetLabel}
          </p>
        ) : null}

        <ModalActions />
      </div>
    </div>
  );
}
