import { defineConfig } from "oxfmt";

export default defineConfig({
  ignorePatterns: [
    "dist/**",
    "out/**",
    "node_modules",
    ".wrangler/**",
    ".astro/**",
    "coverage/**",
    "target/**",
    "*.mdx",
  ],
});
