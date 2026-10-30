import type { NextConfig } from "next";

// Go API (cmd/sockabus): the browser calls /api/*, and src/app/api/[...path]/route.ts forwards it
// with the operator token (SOCKABUS_API_URL, SOCKABUS_OPERATOR_TOKEN are read at request time).
const nextConfig: NextConfig = {
  output: "standalone", // web/Dockerfile runs .next/standalone/server.js
  cacheComponents: true,
  partialPrefetching: true,
};

export default nextConfig;
