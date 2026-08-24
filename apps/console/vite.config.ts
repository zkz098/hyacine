import { defineConfig } from "vite";
import solid from "vite-plugin-solid";
import UnoCSS from "unocss/vite";

export default defineConfig({
  base: "./",
  plugins: [solid(), UnoCSS()],
  server: {
    port: 5173,
  },
});
