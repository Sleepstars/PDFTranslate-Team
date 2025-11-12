import createNextIntlPlugin from 'next-intl/plugin';

const withNextIntl = createNextIntlPlugin('./i18n/request.ts');

/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'standalone',
  async rewrites() {
    const apiBase = process.env.API_BASE_URL || 'http://pdfbackend:8000';
    return [
      {
        source: '/api/:path*',
        destination: `${apiBase}/api/:path*`,
      },
      {
        source: '/auth/:path*',
        destination: `${apiBase}/auth/:path*`,
      },
    ];
  },
};

export default withNextIntl(nextConfig);
