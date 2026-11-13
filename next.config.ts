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
    // Cache del optimizador: 1 día. Las fotos de propiedades rotan seguido
    // (altas/bajas/reemplazos semanales); un reemplazo en la misma URL puede
    // tardar hasta 24h en verse. Subir si el catálogo se vuelve más estático.
    minimumCacheTTL: 86400,
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
      // Foto del aviso de MercadoLibre en los interesados sin propiedad vinculada.
      {
        protocol: "https",
        hostname: "http2.mlstatic.com",
      },
    ],
  },
  // Recorrido 360 de OLMO Residencias: sitio estático en public/web/olmo.
  async rewrites() {
    return [{ source: "/web/olmo", destination: "/web/olmo/index.html" }];
  },
  async headers() {
    // Solo las imágenes versionadas (?v=) llevan caché larga; el index y el
    // código se revalidan siempre para que un cambio se vea al instante.
    const immutable = [{ key: "Cache-Control", value: "public, max-age=31536000, immutable" }];
    return [
      { source: "/web/olmo/tiles/:path*", headers: immutable },
      { source: "/web/olmo/thumbs/:path*", headers: immutable },
    ];
  },
};

export default nextConfig;
