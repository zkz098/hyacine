import { defineConfig } from "tsdown";

export default defineConfig({
  entry: "src/index.ts",
  format: "esm",
  target: "node22",
  clean: true,
  external: ["commander", "gray-matter", "yaml", "tar"],
  noExternal: ["@hyacine/contract", "zod"],
  dts: false,
  sourcemap: false,
  unbundle: false,
});
