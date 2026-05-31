import path from "node:path";
import { fileURLToPath } from "node:url";

import { withSentryConfig } from "@sentry/nextjs";
import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";

const withNextIntl = createNextIntlPlugin();

const webDir = path.dirname(fileURLToPath(import.meta.url));

const nextConfig: NextConfig = {
  transpilePackages: ["@auto8/shared"],
  turbopack: {
    root: path.join(webDir, "../..")
  }
};

const sentryEnabled = !!process.env["NEXT_PUBLIC_SENTRY_DSN"];

export default sentryEnabled
  ? withSentryConfig(withNextIntl(nextConfig), {
      org: process.env["SENTRY_ORG"] ?? "",
      project: process.env["SENTRY_PROJECT"] ?? "",
      silent: true,
    })
  : withNextIntl(nextConfig);
