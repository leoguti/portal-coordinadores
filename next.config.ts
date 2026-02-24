import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    serverActions: {
      bodySizeLimit: "8mb",
    },
  },
  outputFileTracingIncludes: {
    "/api/certificados/*": ["./lib/email-assets/**/*"],
  },
};

export default nextConfig;
