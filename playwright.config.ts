import { defineConfig, devices } from '@playwright/test';
import { createArgosReporterOptions } from '@argos-ci/playwright/reporter';

const uploadToArgos = Boolean(process.env.CI && process.env.ARGOS_TOKEN);

export default defineConfig({
  testDir: 'e2e',
  // AppleDouble / exFAT: ._filename obok .spec.ts — bez tego Playwright parsuje śmieci.
  testIgnore: ['**/._*'],
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  workers: process.env.CI ? 2 : undefined,
  timeout: 300_000,
  expect: { timeout: 15_000 },
  reporter: [
    process.env.CI ? ['dot'] : ['list'],
    [
      '@argos-ci/playwright/reporter',
      createArgosReporterOptions({
        uploadToArgos,
        ...(process.env.ARGOS_TOKEN
          ? { token: process.env.ARGOS_TOKEN }
          : {}),
      }),
    ],
  ],
  use: {
    baseURL: 'http://127.0.0.1:3000',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    bypassCSP: true,
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: {
    command: process.env.CI ? 'npm run start' : 'npm run dev',
    url: 'http://127.0.0.1:3000',
    reuseExistingServer: !process.env.CI,
    timeout: 180_000,
    stdout: 'pipe',
    stderr: 'pipe',
  },
});
