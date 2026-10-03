import type { NextConfig } from 'next';
import { securityHeaders } from '@pokopia/security/headers';
import { validateHostedEnvironment } from '@pokopia/security';

const target = process.env.POKOPIA_DEPLOYMENT_TARGET;
if (target === 'staging' || target === 'production') {
  const environment = validateHostedEnvironment(process.env, target, 'web');
  if (!environment.valid) throw new Error(environment.errors.join(' '));
}

const config: NextConfig = {
  output: 'standalone',
  allowedDevOrigins: ['127.0.0.1'],
  transpilePackages: [
    '@pokopia/game-data',
    '@pokopia/rules',
    '@pokopia/scoring',
    '@pokopia/security',
    '@pokopia/search',
    '@pokopia/ui',
  ],
  serverExternalPackages: [],
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [...securityHeaders(process.env.NODE_ENV === 'production')],
      },
      {
        source: '/api/:path*',
        headers: [{ key: 'Cache-Control', value: 'no-store' }],
      },
    ];
  },
};
export default config;
