import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: {
      "#src": new URL("./src", import.meta.url).pathname,
    },
  },
  test: {
    globals: true,
    environment: "node",
    include: ["tests/**/*.test.ts"],
    coverage: {
      provider: "v8",
      reporter: ["json", "html", "lcov"],
      include: ["src/**/*.ts"],
      thresholds: {
        lines: 80,
        functions: 80,
        branches: 80,
        statements: 80,
      },
    },
  },
});
