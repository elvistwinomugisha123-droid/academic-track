import { defineConfig } from "vitest/config";
import path from "node:path";

export default defineConfig({
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "src"),
      "server-only": path.resolve(__dirname, "src/test/server-only.ts"),
    },
  },
  test: {
    environment: "node",
    include: ["src/security/security.integration.test.ts", "src/academic-operations/academic-operations.integration.test.ts", "src/knowledge/curriculum-bindings.integration.test.ts", "src/artifacts/artifacts.integration.test.ts", "src/assessment/assessment.integration.test.ts"],
    // These suites share one remote isolated TEST Supabase project. Running files in
    // parallel can exhaust its PostgREST/Auth connection pool and turn healthy tests
    // into infrastructure timeouts. Keep the integration lane intentionally serial.
    fileParallelism: false,
    maxWorkers: 1,
    testTimeout: 30_000,
    hookTimeout: 60_000,
  },
});
