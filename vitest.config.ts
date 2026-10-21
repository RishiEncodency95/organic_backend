import { defineConfig } from "vitest/config";

// Infrastructure module tests (unit specs + MongoDB-backed API tests). Run: npx vitest run
export default defineConfig({
  test: {
    include: ["tests/**/*.spec.ts"],
    testTimeout: 60_000,
    hookTimeout: 60_000,
    // The API tests share one database, so test files run one after another.
    fileParallelism: false,
  },
});
