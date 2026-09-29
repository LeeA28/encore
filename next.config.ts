import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Spotify requires the loopback address 127.0.0.1 (not "localhost") for login redirects,
  // so the dev server needs to allow hot reload from it too
  allowedDevOrigins: ["127.0.0.1"],
};

export default nextConfig;
