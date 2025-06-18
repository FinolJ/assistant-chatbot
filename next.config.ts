import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  transpilePackages: [
    'errlop',
    'editions',
    'istextorbinary',
    'async-disk-cache',
    'microsoft-cognitiveservices-speech-sdk',
    'botframework-webchat',
    'botframework-webchat-api',
    'botframework-webchat-core',
  ],

  webpack: (config) => {
    config.resolve.extensionAlias = {
      ".js": [".ts", ".tsx", ".js", ".jsx"],
      ".mjs": [".mts", ".mjs"],
      ".cjs": [".cts", ".cjs"],
    };
    return config;
  },
};

export default nextConfig;