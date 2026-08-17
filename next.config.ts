import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Playwright no debe bundlearse: se resuelve como paquete de Node en runtime.
  serverExternalPackages: ["playwright", "playwright-core"],
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "images.unsplash.com",
      },
      {
        protocol: "https",
        hostname: "lh3.googleusercontent.com",
      },
    ],
  },
};

export default nextConfig;
