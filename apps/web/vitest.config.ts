import { defineConfig } from "vitest/config";

/**
 * Testes unitários (web). Os testes E2E/screenshot ficam em `e2e/` e rodam
 * com o Playwright (`npm run test:e2e`), não com o Vitest.
 */
export default defineConfig({
  test: {
    exclude: ["**/node_modules/**", "**/e2e/**", "**/.next/**"],
  },
});
