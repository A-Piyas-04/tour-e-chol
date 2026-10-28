import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Personalized balances must never be served from a shared static cache.
  // Pages that read tour data opt into dynamic rendering individually.
};

export default nextConfig;
