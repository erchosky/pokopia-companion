import type { NextConfig } from 'next';
import { securityHeaders } from '@pokopia/security/headers';
import { validateHostedEnvironment } from '@pokopia/security';

const target = process.env.POKOPIA_DEPLOYMENT_TARGET;
if (target === 'staging' || target === 'production') {
  const environment = validateHostedEnvironment(process.env, target, 'admin');
  if (!environment.valid) throw new Error(environment.errors.join(' '));
}
const config: NextConfig = {
  output: 'standalone',
  transpilePackages: ['@pokopia/game-data', '@pokopia/security', '@pokopia/ui'],
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          ...securityHeaders(process.env.NODE_ENV === 'production'),
          { key: 'Cache-Control', value: 'private, no-store' },
        ],
      },
    ];
  },
};
export default config;
