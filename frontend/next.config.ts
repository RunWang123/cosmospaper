import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async rewrites() {
    // Proxy /api/ requests to the FastAPI backend on port 8000.
    // This makes the app work whether accessed via Nginx (port 80/443)
    // OR directly on port 3000 — both will correctly reach the backend.
    return [
      {
        source: "/api/:path*",
        destination: "http://127.0.0.1:8000/api/:path*",
      },
    ];
  },
};

export default nextConfig;
