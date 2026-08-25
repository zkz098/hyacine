import { defineConfig } from "vite";
import solid from "vite-plugin-solid";
import UnoCSS from "unocss/vite";

export default defineConfig({
  base: "./",
  plugins: [solid(), UnoCSS()],
  server: {
    port: 5199,
    // satteri 浏览器 WASI 构建需要 SharedArrayBuffer → 页面必须 cross-origin isolated
    headers: {
      "Cross-Origin-Opener-Policy": "same-origin",
      "Cross-Origin-Embedder-Policy": "require-corp",
    },
  },
  preview: {
    headers: {
      "Cross-Origin-Opener-Policy": "same-origin",
      "Cross-Origin-Embedder-Policy": "require-corp",
    },
  },
});
