import { defineConfig } from "tsdown";
import packageJson from "./package.json" with { type: "json" };

export default defineConfig({
  entry: "src/index.ts",
  format: "esm",
  target: "node24",
  clean: true,
  deps: {
    neverBundle: ["commander", "gray-matter", "yaml", "tar"],
    alwaysBundle: ["@hyacine/contract", "zod"],
  },
  define: {
    __VERSION__: JSON.stringify(packageJson.version),
  },
  dts: true,
  sourcemap: false,
  unbundle: false,
});
