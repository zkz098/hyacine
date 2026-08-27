import { describe, expect, it } from "vitest";
import { visibilityTitle } from "./index";

describe("@hyacine/plugin-visibility-title", () => {
  it("should create valid runtime-only manifest with default options", () => {
    const manifest = visibilityTitle();
    expect(manifest.name).toBe("@hyacine/plugin-visibility-title");
    expect(manifest.minRenderCapability).toBe("runtime-only");
    expect(manifest.entry).toHaveLength(1);
    expect(manifest.entry[0]!.type).toBe("runtime-only");
    expect(manifest.entry[0]!.injectPoint).toBe("layout");
    expect((manifest.entry[0] as any).options.enable).toBe(true);
  });

  it("should accept custom title options", () => {
    const manifest = visibilityTitle({
      enable: false,
      leaveTitle: "Bye",
      returnTitle: "Hi",
      restoreDelay: 5000,
    });
    expect((manifest.entry[0] as any).options).toEqual({
      enable: false,
      leaveTitle: "Bye",
      returnTitle: "Hi",
      restoreDelay: 5000,
    });
  });
});
