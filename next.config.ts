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
};

export default nextConfig;
