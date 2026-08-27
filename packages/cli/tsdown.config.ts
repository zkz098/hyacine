import { defineConfig } from "tsdown";

export default defineConfig({
  entry: "src/index.ts",
  format: "esm",
  target: "node24",
  clean: true,
  deps: {
    neverBundle: ["commander", "gray-matter", "yaml", "tar"],
    alwaysBundle: ["@hyacine/contract", "zod"],
  },
  dts: true,
  sourcemap: false,
  unbundle: false,
});
