import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Puppeteer + chromium-min must not be bundled by Turbopack —
  // they ship native binaries / large platform-specific files.
  serverExternalPackages: ["puppeteer-core", "@sparticuz/chromium-min"],
};

export default nextConfig;
