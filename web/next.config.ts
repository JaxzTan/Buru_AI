import type { NextConfig } from "next";

// Go API (cmd/buru). Browser calls /api/* and Next proxies them, so no CORS in dev.
const apiURL = process.env.BURU_API_URL ?? "http://localhost:8080";

const nextConfig: NextConfig = {
  cacheComponents: true,
  partialPrefetching: true,
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
  redirects() {
    return [
      { source: "/operator", destination: "/operator/overview", permanent: false },
      { source: "/portal", destination: "/portal/lookup", permanent: false },
    ];
  },
  rewrites() {
    return [{ source: "/api/:path*", destination: `${apiURL}/:path*` }];
  },
};

export default nextConfig;
