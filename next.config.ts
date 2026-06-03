import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  // Pin the workspace root to this project (avoid Turbopack mis-inferring a parent folder).
  turbopack: { root: import.meta.dirname },
  // The deterministic engine + adapters are server-only; keep node built-ins (crypto) on the server.
  serverExternalPackages: ["@prisma/client"],
};

export default nextConfig;
