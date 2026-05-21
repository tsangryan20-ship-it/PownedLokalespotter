import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ['better-sqlite3'],
  experimental: {
    // Allow JSON imports from data directory
  },
};

export default nextConfig;
