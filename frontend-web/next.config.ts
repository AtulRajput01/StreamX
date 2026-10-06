import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Allow all local network IPs for development
  experimental: {
    // Next.js 14+ sometimes requires experimental flags, but Next.js 15 uses allowedDevOrigins natively
  },
  // We'll just allow common local IPs
  allowedDevOrigins: ['192.168.1.81', '192.168.0.81'],
};

export default nextConfig;
