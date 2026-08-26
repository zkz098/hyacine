import { definePlugin, type PluginManifest } from "@hyacine/plugin-core";

export interface VercountPluginOptions {
  apiBase?: string;
}

export function vercount(options: VercountPluginOptions = {}): PluginManifest {
  return definePlugin({
    name: "@hyacine/plugin-vercount",
    version: "0.1.0",
    minRenderCapability: "runtime-only",
    entry: [
      {
        name: "vercount-runtime",
        type: "runtime-only",
        injectPoint: "layout",
        path: new URL("./runtime.ts", import.meta.url).href,
        options: {
          apiBase: options.apiBase,
        },
      },
    ],
  });
}

export default vercount;
