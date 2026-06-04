import type { NextConfig } from "next";

// Security headers. PRD §13.2. CSP allows the Google Fonts + Google OAuth form-post the app uses;
// vendor LLM calls happen server-side so the browser only talks to 'self'.
const isProd = process.env.NODE_ENV === "production";
const csp = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline'${isProd ? "" : " 'unsafe-eval'"}`,
  "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
  "font-src 'self' https://fonts.gstatic.com",
  "img-src 'self' data: blob: https:",
  "connect-src 'self'",
  "frame-ancestors 'none'",
  "base-uri 'self'",
  "form-action 'self' https://accounts.google.com",
].join("; ");

const securityHeaders = [
  { key: "Content-Security-Policy", value: csp },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
  ...(isProd
    ? [{ key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" }]
    : []),
];

const nextConfig: NextConfig = {
  reactStrictMode: true,
  // Never ship browser source maps in prod (keeps original server/module source out of the client).
  productionBrowserSourceMaps: false,
  // Pin the workspace root to this project (avoid Turbopack mis-inferring a parent folder).
  turbopack: { root: import.meta.dirname },
  // Server-only, dynamically-imported infra: keep them out of the bundle (loaded at runtime when configured).
  serverExternalPackages: ["@prisma/client", "puppeteer", "ioredis", "@aws-sdk/client-s3", "@aws-sdk/s3-request-presigner", "@aws-sdk/client-kms"],
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },
};

export default nextConfig;
