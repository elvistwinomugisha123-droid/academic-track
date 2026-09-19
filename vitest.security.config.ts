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
    include: ["src/security/security.integration.test.ts", "src/academic-operations/academic-operations.integration.test.ts", "src/knowledge/curriculum-bindings.integration.test.ts"],
    testTimeout: 15_000,
    hookTimeout: 30_000,
  },
});
