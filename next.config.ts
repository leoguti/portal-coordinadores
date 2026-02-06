import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    serverActions: {
      bodySizeLimit: "4.5mb", // Default is 1MB; needed for base64 file uploads (3MB file ≈ 4MB base64)
    },
  },
};

export default nextConfig;
