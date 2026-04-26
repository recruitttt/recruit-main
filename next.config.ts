import type { NextConfig } from "next";
import path from "node:path";

const nextConfig: NextConfig = {
  // Puppeteer + chromium-min must not be bundled by Turbopack —
  // they ship native binaries / large platform-specific files.
  serverExternalPackages: ["puppeteer-core", "@sparticuz/chromium-min"],
  turbopack: {
    root: path.resolve(__dirname),
  },
  // Static-resume override: every tailored-resume preview/download is
  // intercepted before reaching the per-job API handler and rewritten to
  // serve the bundled PDF in /public/static. Works in dev and on Vercel
  // because `public/` ships with the deploy.
  async rewrites() {
    return [
      {
        source: "/api/dashboard/resume-pdf",
        destination: "/static/Om_Sanan_Resume.pdf",
      },
      {
        source: "/api/dashboard/resume-pdf/:path*",
        destination: "/static/Om_Sanan_Resume.pdf",
      },
    ];
  },
};

export default nextConfig;
