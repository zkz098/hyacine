import { definePlugin, type PluginManifest } from "@hyacine/plugin-core";

export interface MouseFireworkOptions {
  count?: number;
  radius?: number;
  colors?: string[];
}

export function mouseFirework(options: MouseFireworkOptions = {}): PluginManifest {
  return definePlugin({
    name: "@hyacine/plugin-mouse-firework",
    version: "0.1.0",
    minRenderCapability: "runtime-only",
    entry: [
      {
        name: "mouse-firework-runtime",
        type: "runtime-only",
        injectPoint: "layout",
        path: new URL("./runtime.ts", import.meta.url).href,
        options: {
          count: options.count ?? 16,
          radius: options.radius ?? 80,
          colors: options.colors,
        },
      },
    ],
  });
}

export default mouseFirework;
