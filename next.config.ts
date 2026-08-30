import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  reactCompiler: true,
  allowedDevOrigins: ["127.0.0.1"],
  images: {
    remotePatterns: [
      { hostname: "**.scdn.co" },
      { hostname: "**.spotifycdn.com" },
    ],
  },
};

export default nextConfig;
