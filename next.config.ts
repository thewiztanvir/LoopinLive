import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  allowedDevOrigins: ["live.shajon.dev", "192.168.0.106"],
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "s3.aynaott.com",
      },
      {
        protocol: "https",
        hostname: "avatars.githubusercontent.com",
      },
      {
        protocol: "https",
        hostname: "drive.google.com",
      },
      {
        protocol: "https",
        hostname: "drive.usercontent.google.com",
      },
    ],
  },
};

export default nextConfig;
