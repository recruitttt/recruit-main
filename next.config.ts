import type { NextConfig } from "next";
import path from "node:path";

// Static asset notes:
// - 3D GLB furniture lives in `public/models/` (sourced from the CC0
//   Kenney Furniture Kit at https://kenney.nl/assets/furniture-kit).
// - Draco decoder JS/WASM lives in `public/draco/`, copied once from
//   `node_modules/three/examples/jsm/libs/draco/gltf/`. To refresh the
//   decoder after a `three` upgrade, run:
//     cp node_modules/three/examples/jsm/libs/draco/gltf/draco_decoder.* \
//        node_modules/three/examples/jsm/libs/draco/gltf/draco_wasm_wrapper.js \
//        public/draco/
const nextConfig: NextConfig = {
  // Puppeteer + chromium-min must not be bundled by Turbopack —
  // they ship native binaries / large platform-specific files.
  serverExternalPackages: ["puppeteer-core", "@sparticuz/chromium-min"],
  turbopack: {
    root: path.resolve(__dirname),
  },
};

export default nextConfig;
