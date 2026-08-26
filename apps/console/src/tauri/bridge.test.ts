import { describe, expect, it } from "vitest";
import { isTauri } from "./bridge";

describe("tauri bridge", () => {
  it("isTauri 在浏览器/jsdom 下为 false", () => {
    expect(isTauri()).toBe(false);
  });

  it("非 tauri 环境调用抛出 require_tauri", async () => {
    const { readTextFile } = await import("./bridge");
    await expect(readTextFile("/tmp/x")).rejects.toThrow("require_tauri");
  });

  it("openFolderDialog 在非 tauri 抛错", async () => {
    const { openFolderDialog } = await import("./bridge");
    await expect(openFolderDialog()).rejects.toThrow("require_tauri");
  });

  it("removeFile 在非 tauri 抛错", async () => {
    const { removeFile } = await import("./bridge");
    await expect(removeFile("/tmp/x")).rejects.toThrow("require_tauri");
  });
});
