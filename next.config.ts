import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Playwright no debe bundlearse: se resuelve como paquete de Node en runtime.
  serverExternalPackages: [
    "playwright",
    "playwright-core",
    "playwright-extra",
    "puppeteer-extra-plugin-stealth",
  ],
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
      // Fotos de propiedades migradas a Supabase Storage (bucket property-photos).
      {
        protocol: "https",
        hostname: "omuepkjofhdustjajcuw.supabase.co",
      },
      // Fallback: alguna foto puede seguir en Tokko si su transferencia falló.
      {
        protocol: "https",
        hostname: "static.tokkobroker.com",
      },
    ],
  },
};

export default nextConfig;
