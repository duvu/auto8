import path from "node:path";
import { fileURLToPath } from "node:url";

import type { NextConfig } from "next";

const webDir = path.dirname(fileURLToPath(import.meta.url));

const nextConfig: NextConfig = {
  transpilePackages: ["@auto8/shared"],
  turbopack: {
    root: path.join(webDir, "../..")
  }
};

export default nextConfig;
