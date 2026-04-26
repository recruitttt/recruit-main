import type { NextConfig } from "next";
import path from "node:path";

const nextConfig: NextConfig = {
  // Puppeteer + chromium-min must not be bundled by Turbopack —
  // they ship native binaries / large platform-specific files.
  serverExternalPackages: ["puppeteer-core", "@sparticuz/chromium-min"],
  turbopack: {
    root: path.resolve(__dirname),
  },
};

export default nextConfig;
