import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: true,
  retries: process.env.CI ? 2 : 0,
  reporter: process.env.CI ? 'github' : 'list',
  use: { baseURL: 'http://127.0.0.1:3000', trace: 'on-first-retry' },
  projects: [
    {
      name: 'desktop-chromium',
      use: {
        ...devices['Desktop Chrome'],
        extraHTTPHeaders: { 'x-forwarded-for': '203.0.113.10' },
      },
    },
    {
      name: 'mobile-chromium',
      use: {
        ...devices['Pixel 7'],
        extraHTTPHeaders: { 'x-forwarded-for': '203.0.113.11' },
      },
    },
  ],
  webServer: {
    command: 'npm run dev --workspace @pokopia/web',
    env: { POKOPIA_TRUST_PROXY_HEADERS: 'true' },
    url: 'http://127.0.0.1:3000/api/health',
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
});
