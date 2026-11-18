import type { NextConfig } from "next";

const dev = process.env.NODE_ENV !== "production";

/** Política de seguridad de contenido. Redsys necesita recibir el formulario de pago (Bizum). */
const csp = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline' 'wasm-unsafe-eval' https://js.stripe.com${dev ? " 'unsafe-eval'" : ""}`,
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob: https://*.stripe.com",
  "font-src 'self' data:",
  `connect-src 'self' blob: data: https://api.stripe.com https://*.stripe.com${dev ? " ws:" : ""}`,
  "worker-src 'self' blob:",
  "media-src 'self' blob:",
  // Formulario de tarjeta embebido de Stripe (iframes seguros) y 3D Secure.
  "frame-src https://js.stripe.com https://*.js.stripe.com https://hooks.stripe.com",
  "frame-ancestors 'none'",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self' https://sis.redsys.es https://sis-t.redsys.es:25443",
  ...(process.env.VERCEL ? ["upgrade-insecure-requests"] : []),
].join("; ");

const security = [
  { key: "Content-Security-Policy", value: csp },
  { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(self), microphone=(), geolocation=(), payment=(self \"https://js.stripe.com\")" },
  { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
];

const nextConfig: NextConfig = {
  cacheComponents: true,
  partialPrefetching: true,
  poweredByHeader: false,
  serverExternalPackages: ["@node-rs/argon2"],
  async headers() {
    return [
      { source: "/:path*", headers: security },
      { source: "/api/:path*", headers: [{ key: "X-Robots-Tag", value: "noindex" }] },
    ];
  },
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
