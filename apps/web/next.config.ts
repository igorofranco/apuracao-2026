import path from "node:path";
import type { NextConfig } from "next";

/**
 * Para onde o Next proxya `/api/*` (server-side).
 * Padrão: o collector local. Pode ser sobrescrito no BUILD.
 * Em produção com nginx proxiando `/api`, este rewrite nem é acionado.
 */
const API_PROXY_TARGET = process.env.API_PROXY_TARGET ?? "http://127.0.0.1:8787";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  transpilePackages: ["@apuracao/shared", "@apuracao/domain"],
  env: {
    // Browser fala na mesma origem; o proxy é feito aqui (dev/sem nginx) ou no nginx.
    NEXT_PUBLIC_API_URL: process.env.NEXT_PUBLIC_API_URL ?? "",
  },
  experimental: {
    // Inline do Tailwind no HTML: elimina a requisição de CSS que bloqueia a
    // renderização (FCP/LCP). Indicado para CSS atômico (poucos KB).
    inlineCss: true,
  },
  turbopack: {
    rules: {
      // O Next injeta `next-polyfill-module` em todo build mesmo com alvos
      // modernos (vercel/next.js#86785). Como o browserslist (chrome/edge/
      // firefox 111+, safari 16.4+) já cobre tudo que ele fornece, esvaziamos
      // o módulo para não servir JavaScript legado (Lighthouse).
      "**/polyfill-module.js": {
        condition: { all: ["browser", "production"] },
        loaders: [path.join(process.cwd(), "empty-polyfill-module-loader.cjs")],
        as: "*.js",
      },
    },
  },
  async rewrites() {
    if (!API_PROXY_TARGET) return [];
    return [
      {
        source: "/api/:path*",
        destination: `${API_PROXY_TARGET}/api/:path*`,
      },
    ];
  },
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          {
            key: "Permissions-Policy",
            value: "camera=(), microphone=(), geolocation=(), payment=()",
          },
          {
            key: "Strict-Transport-Security",
            value: "max-age=63072000; includeSubDomains",
          },
        ],
      },
    ];
  },
};

export default nextConfig;
