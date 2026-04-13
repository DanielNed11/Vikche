import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "douglas.bg",
      },
      {
        protocol: "https",
        hostname: "www.douglas.bg",
      },
      {
        protocol: "https",
        hostname: "adm1n.douglas.bg",
      },
    ],
  },
  outputFileTracingIncludes: {
    "/api/watchlist/resolve": [
      "./node_modules/playwright-core/.local-browsers/**/*",
    ],
    "/api/watchlist/items": [
      "./node_modules/playwright-core/.local-browsers/**/*",
    ],
    "/api/watchlist/items/\\[id\\]/refresh": [
      "./node_modules/playwright-core/.local-browsers/**/*",
    ],
    "/api/admin/run-due-checks": [
      "./node_modules/playwright-core/.local-browsers/**/*",
    ],
  },
};

export default nextConfig;
