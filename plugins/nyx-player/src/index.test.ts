import { describe, expect, it } from "vitest";
import { nyxPlayer } from "./index";

describe("@hyacine/plugin-nyx-player", () => {
  it("should create valid ssr manifest", () => {
    const manifest = nyxPlayer({
      enable: true,
      urls: [{ name: "Test", url: "https://music.163.com/#/playlist?id=123" }],
      preset: "shokax",
      metingBaseURL: "https://meting.api.example.com",
    });

    expect(manifest.name).toBe("@hyacine/plugin-nyx-player");
    expect(manifest.minRenderCapability).toBe("ssr");
    expect(manifest.supportedPlatforms).toEqual(["astro"]);
    expect(manifest.entry).toHaveLength(1);
    expect(manifest.entry[0]!.type).toBe("ssr");
    expect(manifest.entry[0]!.injectPoint).toBe("layout-bottom");
    expect((manifest.entry[0] as any).props.enable).toBe(true);
    expect((manifest.entry[0] as any).props.preset).toBe("shokax");
  });

  it("should disable when urls are empty", () => {
    const manifest = nyxPlayer({
      enable: true,
      urls: [],
    });

    expect((manifest.entry[0] as any).props.enable).toBe(false);
  });
});
