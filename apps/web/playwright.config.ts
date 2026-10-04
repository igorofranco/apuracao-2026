import { defineConfig, devices } from "@playwright/test";

/**
 * Testes E2E de fumaça + screenshots.
 *
 * Sobe um mock do collector (e2e/mock-server.mjs) e o Next em dev apontando o
 * proxy /api para ele. Roda em desktop e mobile e salva as capturas em
 * e2e/screenshots/<projeto>/<página>.png.
 *
 *   npm run test:e2e -w @apuracao/web
 */
export default defineConfig({
  testDir: "./e2e",
  timeout: 60_000,
  expect: { timeout: 15_000 },
  fullyParallel: false,
  workers: 1,
  retries: 0,
  reporter: [["list"], ["html", { open: "never", outputFolder: "e2e/.report" }]],
  outputDir: "./e2e/.artifacts",
  use: {
    baseURL: "http://localhost:3000",
    trace: "retain-on-failure",
    screenshot: "off",
    video: "off",
  },
  projects: [
    {
      name: "desktop",
      use: { ...devices["Desktop Chrome"], viewport: { width: 1440, height: 900 } },
    },
    {
      name: "mobile",
      use: { ...devices["Pixel 7"] },
    },
  ],
  webServer: [
    {
      command: "node e2e/mock-server.mjs",
      url: "http://127.0.0.1:8787/health",
      reuseExistingServer: !process.env.CI,
      timeout: 30_000,
    },
    {
      command: "npm run dev",
      url: "http://localhost:3000",
      reuseExistingServer: !process.env.CI,
      timeout: 180_000,
      env: {
        API_PROXY_TARGET: process.env.API_PROXY_TARGET ?? "http://127.0.0.1:8787",
      },
    },
  ],
});
