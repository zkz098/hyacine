import { describe, expect, it } from "vitest";
import { articleStatistics } from "./index";

describe("@hyacine/plugin-article-statistics", () => {
  it("should create valid ssr manifest", () => {
    const manifest = articleStatistics({
      enable: true,
      chartLabels: {
        monthlyPosts: "Monthly Trend",
      },
    });

    expect(manifest.name).toBe("@hyacine/plugin-article-statistics");
    expect(manifest.minRenderCapability).toBe("ssr");
    expect(manifest.supportedPlatforms).toEqual(["astro"]);
    expect(manifest.entry).toHaveLength(1);
    expect(manifest.entry[0]!.type).toBe("ssr");
    expect(manifest.entry[0]!.injectPoint).toBe("article-statistics");
    expect((manifest.entry[0] as any).props.enable).toBe(true);
    expect((manifest.entry[0] as any).props.chartLabels.monthlyPosts).toBe("Monthly Trend");
  });

  it("should support default options", () => {
    const manifest = articleStatistics();
    expect((manifest.entry[0] as any).props.enable).toBe(true);
  });
});
