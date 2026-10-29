import type { NextConfig } from "next";

// Go API (cmd/sockabus). Browser calls /api/* and Next proxies them, so no CORS in dev.
const apiURL = process.env.SOCKABUS_API_URL ?? "http://localhost:8080";

const nextConfig: NextConfig = {
  output: "standalone", // web/Dockerfile runs .next/standalone/server.js
  cacheComponents: true,
  partialPrefetching: true,
  redirects() {
    return [{ source: "/", destination: "/personas", permanent: false }];
  },
  rewrites() {
    return [{ source: "/api/:path*", destination: `${apiURL}/:path*` }];
  },
};

export default nextConfig;
