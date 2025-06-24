import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  allowedDevOrigins: ['8406-185-177-126-152.ngrok-free.app'],
  webpack: (config) => {

    config.resolve.alias = {
      ...config.resolve.alias,
   
      cldr$: "cldrjs/dist/cldr",
      "cldr/event$": "cldrjs/dist/cldr/event",
      "cldr/supplemental$": "cldrjs/dist/cldr/supplemental",
    };
    return config;
  },
};

export default nextConfig;