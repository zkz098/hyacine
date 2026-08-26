import path from "node:path";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: {
      "@hyacine/contract": path.resolve(import.meta.dirname, "../contract/src/index.ts"),
      "@hyacine/plugin-core": path.resolve(import.meta.dirname, "../plugin-core/src/index.ts"),
    },
  },
  test: {
    environment: "node",
    include: ["src/**/*.test.ts"],
  },
});
