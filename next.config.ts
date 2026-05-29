import type { NextConfig } from "next";

const config: NextConfig = {
  reactStrictMode: true,
  experimental: {
    // typedRoutes — re-enable once /legal/* pages exist and derived hrefs are typed.
    typedRoutes: false,
  },
  images: {
    formats: ["image/avif", "image/webp"],
  },
};

export default config;
