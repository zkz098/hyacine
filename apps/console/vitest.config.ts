import { defineConfig } from "vitest/config";
import solid from "vite-plugin-solid";
import path from "node:path";

export default defineConfig({
  plugins: [solid({ hot: false })],
  test: {
    environment: "jsdom",
    globals: true,
    include: ["src/**/*.test.ts", "src/**/*.test.tsx"],
    setupFiles: ["./src/test-setup.ts"],
  },
  resolve: {
    conditions: ["development", "browser"],
    alias: {
      "@hyacine/contract": path.resolve(
        import.meta.dirname,
        "../../packages/contract/src/index.ts",
      ),
    },
  },
});
