import { fileURLToPath } from 'node:url';
import { defineConfig } from '@playwright/test';
export default defineConfig({
  testDir: './tests/e2e',
  testMatch: '*.spec.ts',
  outputDir: './test-results/e2e',
  timeout: 60000,
  expect: { timeout: 20000 },
  fullyParallel: false,
  workers: 1,
  retries: 1,
  reporter: [['list'], ['html', { open: 'never' }]],
  webServer: [
    {
      command:
        'pnpm --filter @nextjs-devtools/demo build && pnpm --filter @nextjs-devtools/demo exec next start -p 3210',
      cwd: fileURLToPath(new URL('../..', import.meta.url)),
      url: 'http://localhost:3210',
      reuseExistingServer: false,
      timeout: 180000,
      env: { NEXT_TELEMETRY_DISABLED: '1' },
    },
    {
      command: 'pnpm --filter @nextjs-devtools/demo exec next dev -p 3211',
      cwd: fileURLToPath(new URL('../..', import.meta.url)),
      url: 'http://localhost:3211',
      reuseExistingServer: false,
      timeout: 120000,
      env: { NEXT_TELEMETRY_DISABLED: '1' },
    },
  ],
});
