"use client";

const HEART_PATH =
  "M128 224S38.4 170.7 18.7 108.8C4.2 63.3 31.4 24 72.3 24c25.8 0 48.2 15.3 55.7 39.1C135.5 39.3 157.9 24 183.7 24c40.9 0 68.1 39.3 53.6 84.8C217.6 170.7 128 224 128 224Z";

const HEARTS = [
  {
    top: "6%",
    left: "3%",
    mobileSize: 34,
    desktopSize: 52,
    vwSize: 11,
    opacity: 0.17,
    rotate: -12,
    drift: "0.0s",
    outline: false,
  },
  {
    top: "10%",
    left: "24%",
    mobileSize: 22,
    desktopSize: 34,
    vwSize: 6,
    opacity: 0.12,
    rotate: 16,
    drift: "0.8s",
    outline: true,
  },
  {
    top: "13%",
    left: "38%",
    mobileSize: 18,
    desktopSize: 28,
    vwSize: 5,
    opacity: 0.11,
    rotate: -10,
    drift: "1.1s",
    outline: false,
  },
  {
    top: "14%",
    right: "38%",
    mobileSize: 18,
    desktopSize: 28,
    vwSize: 5,
    opacity: 0.11,
    rotate: 12,
    drift: "1.7s",
    outline: true,
  },
  {
    top: "8%",
    right: "8%",
    mobileSize: 28,
    desktopSize: 44,
    vwSize: 8,
    opacity: 0.14,
    rotate: 10,
    drift: "1.4s",
    outline: false,
  },
  {
    top: "18%",
    left: "30%",
    mobileSize: 24,
    desktopSize: 38,
    vwSize: 6.5,
    opacity: 0.14,
    rotate: -14,
    drift: "0.9s",
    outline: false,
  },
  {
    top: "19%",
    right: "29%",
    mobileSize: 22,
    desktopSize: 34,
    vwSize: 6,
    opacity: 0.13,
    rotate: 16,
    drift: "1.9s",
    outline: false,
  },
  {
    top: "24%",
    left: "41%",
    mobileSize: 16,
    desktopSize: 24,
    vwSize: 4,
    opacity: 0.09,
    rotate: -8,
    drift: "2.3s",
    outline: true,
  },
  {
    top: "25%",
    right: "40%",
    mobileSize: 16,
    desktopSize: 24,
    vwSize: 4,
    opacity: 0.09,
    rotate: 10,
    drift: "0.6s",
    outline: false,
  },
  {
    top: "22%",
    left: "1%",
    mobileSize: 24,
    desktopSize: 36,
    vwSize: 7,
    opacity: 0.12,
    rotate: -18,
    drift: "2.1s",
    outline: true,
  },
  {
    top: "28%",
    left: "12%",
    mobileSize: 18,
    desktopSize: 28,
    vwSize: 5,
    opacity: 0.1,
    rotate: 12,
    drift: "0.4s",
    outline: false,
  },
  {
    top: "32%",
    right: "14%",
    mobileSize: 30,
    desktopSize: 42,
    vwSize: 8,
    opacity: 0.15,
    rotate: 14,
    drift: "0.5s",
    outline: false,
  },
  {
    top: "42%",
    right: "4%",
    mobileSize: 20,
    desktopSize: 30,
    vwSize: 5,
    opacity: 0.11,
    rotate: -8,
    drift: "2.5s",
    outline: true,
  },
  {
    top: "48%",
    left: "7%",
    mobileSize: 26,
    desktopSize: 40,
    vwSize: 7,
    opacity: 0.13,
    rotate: 8,
    drift: "1.8s",
    outline: false,
  },
  {
    top: "55%",
    left: "20%",
    mobileSize: 16,
    desktopSize: 24,
    vwSize: 4,
    opacity: 0.09,
    rotate: -6,
    drift: "2.9s",
    outline: true,
  },
  {
    top: "58%",
    right: "18%",
    mobileSize: 18,
    desktopSize: 28,
    vwSize: 4.5,
    opacity: 0.1,
    rotate: 10,
    drift: "1.1s",
    outline: false,
  },
  {
    top: "66%",
    right: "3%",
    mobileSize: 30,
    desktopSize: 46,
    vwSize: 8.5,
    opacity: 0.16,
    rotate: -10,
    drift: "2.2s",
    outline: false,
  },
  {
    bottom: "24%",
    left: "10%",
    mobileSize: 24,
    desktopSize: 36,
    vwSize: 6.5,
    opacity: 0.13,
    rotate: 18,
    drift: "1.2s",
    outline: true,
  },
  {
    bottom: "18%",
    left: "36%",
    mobileSize: 18,
    desktopSize: 28,
    vwSize: 5,
    opacity: 0.09,
    rotate: -14,
    drift: "3.2s",
    outline: false,
  },
  {
    bottom: "14%",
    right: "14%",
    mobileSize: 34,
    desktopSize: 54,
    vwSize: 10,
    opacity: 0.17,
    rotate: 12,
    drift: "0.9s",
    outline: false,
  },
  {
    bottom: "8%",
    left: "4%",
    mobileSize: 20,
    desktopSize: 30,
    vwSize: 5.5,
    opacity: 0.1,
    rotate: -8,
    drift: "2.6s",
    outline: true,
  },
  {
    bottom: "6%",
    right: "34%",
    mobileSize: 22,
    desktopSize: 34,
    vwSize: 6,
    opacity: 0.11,
    rotate: 15,
    drift: "1.6s",
    outline: true,
  },
  {
    bottom: "4%",
    right: "4%",
    mobileSize: 26,
    desktopSize: 40,
    vwSize: 7,
    opacity: 0.13,
    rotate: -16,
    drift: "2.4s",
    outline: false,
  },
];

export function BackgroundHearts() {
  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden="true">
      {HEARTS.map((heart, index) => (
        <span
          key={`${heart.mobileSize}-${heart.rotate}-${index}`}
          className="absolute block"
          style={{
            top: heart.top,
            left: heart.left,
            right: heart.right,
            bottom: heart.bottom,
            width: `clamp(${heart.mobileSize}px, ${heart.vwSize}vw, ${heart.desktopSize}px)`,
            height: `clamp(${heart.mobileSize}px, ${heart.vwSize}vw, ${heart.desktopSize}px)`,
            opacity: heart.opacity,
            transform: `rotate(${heart.rotate}deg)`,
          }}
        >
          <svg
            viewBox="0 0 256 256"
            className="h-full w-full text-accent"
            style={{
              animation: `vikche-heart-drift 7.8s ease-in-out ${heart.drift} infinite`,
              filter: heart.outline ? "drop-shadow(0 2px 10px rgba(214,86,136,0.06))" : "none",
            }}
          >
            <path
              d={HEART_PATH}
              fill={heart.outline ? "none" : "currentColor"}
              stroke="currentColor"
              strokeWidth={heart.outline ? 18 : 0}
              strokeLinejoin="round"
            />
          </svg>
        </span>
      ))}

      <style jsx>{`
        @keyframes vikche-heart-drift {
          0% {
            transform: translate3d(0, 0, 0) scale(1);
          }
          50% {
            transform: translate3d(0, -10px, 0) scale(1.04);
          }
          100% {
            transform: translate3d(0, 0, 0) scale(1);
          }
        }
      `}</style>
    </div>
  );
}
