// Settings for Vitest, the test runner (npm test).
import { defineConfig } from "vitest/config";
import { fileURLToPath } from "node:url";

export default defineConfig({
  resolve: {
    // Lets tests use the same "@/lib/..." imports as the app
    alias: { "@": fileURLToPath(new URL(".", import.meta.url)) },
  },
  test: {
    include: ["**/*.test.ts"],
    exclude: ["node_modules", ".next"],
    // Run every test in Toronto's time zone, so date tests behave the same on every computer
    // (including GitHub's servers, which use UTC). The time zone bug in formatDate depends on this.
    env: { TZ: "America/Toronto" },
  },
});
