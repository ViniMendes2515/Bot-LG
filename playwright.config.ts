import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './tests',
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: 'html',
  timeout: 30000,
  use: {
    baseURL: 'https://login.lg.com.br',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    storageState: 'state.json',
    actionTimeout: 10000,
    navigationTimeout: 30000,
    headless: process.env.NODE_ENV === 'production',
    viewport: { width: 1280, height: 720 },
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
  webServer: undefined,
});