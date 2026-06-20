import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './src/tests',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: 0,
  workers: 1,
  reporter: 'list',
  
  timeout: 120_000, // Allow 2 min per test (Cast device wake + auth can take ~60s)
  expect: {
    timeout: 15_000,
  },
  use: {
    baseURL: 'http://localhost:1420',
    headless: true,
  },

  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
});
