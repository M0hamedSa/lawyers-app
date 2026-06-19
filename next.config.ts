import type { NextConfig } from "next";
import createNextIntlPlugin from 'next-intl/plugin';

const withNextIntl = createNextIntlPlugin();

const nextConfig: NextConfig = {
  typedRoutes: true,
  serverExternalPackages: ['puppeteer-core', '@sparticuz/chromium-min'],
  outputFileTracingIncludes: {
    '/api/export-transactions': ['./fonts/**/*', './public/logo.png'],
    '/api/export-cash-advance': ['./fonts/**/*', './public/logo.png'],
    '/api/export-user-report': ['./fonts/**/*', './public/logo.png'],
  },
};

export default withNextIntl(nextConfig);
