import { defineConfig } from "vite";
import solid from "vite-plugin-solid";
import UnoCSS from "unocss/vite";
import { fileURLToPath, URL } from "node:url";

export default defineConfig({
  base: "./",
  plugins: [solid(), UnoCSS()],
  resolve: {
    alias: [
      // satteri 浏览器 WASI 绑定：用 ?url 资产导入修复 wasm/worker 定位问题（见
      // src/editor/satteri-wasi-browser.ts）。仅替换裸导入，子路径(?url)仍走原包。
      {
        find: /^@bruits\/satteri-wasm32-wasi$/,
        replacement: fileURLToPath(new URL("./src/editor/satteri-wasi-browser.ts", import.meta.url)),
      },
    ],
  },
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
