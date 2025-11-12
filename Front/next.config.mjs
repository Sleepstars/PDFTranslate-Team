import createNextIntlPlugin from 'next-intl/plugin';

const withNextIntl = createNextIntlPlugin('./i18n/request.ts');

/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'standalone',
  async rewrites() {
    const API_BASE = process.env.API_BASE_URL || 'http://localhost:8000/api';
    const base = API_BASE.replace(/\/$/, '');
    return [
      {
        source: '/api/:path*',
        destination: `${base}/:path*`,
      },
      {
        source: '/auth/:path*',
        destination: `${base}/auth/:path*`,
      },
    ];
  },
};

export default withNextIntl(nextConfig);
