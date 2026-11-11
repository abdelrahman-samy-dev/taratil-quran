import { defineConfig, devices } from '@playwright/test';

/** Smoke tests against the production build (`npm run build` first). */
export default defineConfig({
  testDir: 'tests/e2e',
  timeout: 45_000,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [['github'], ['html', { open: 'never' }]] : 'list',
  use: {
    baseURL: 'http://localhost:5181',
    locale: 'ar-EG',
    timezoneId: 'Africa/Cairo',
    geolocation: { latitude: 30.0444, longitude: 31.2357 },
    permissions: ['geolocation'],
    trace: 'retain-on-failure',
  },
  projects: [
    { name: 'mobile', use: { ...devices['Pixel 7'] } },
    { name: 'desktop', use: { ...devices['Desktop Chrome'], viewport: { width: 1440, height: 900 } } },
  ],
  webServer: {
    command: 'npm run preview',
    url: 'http://localhost:5181',
    reuseExistingServer: !process.env.CI,
    timeout: 60_000,
  },
});
