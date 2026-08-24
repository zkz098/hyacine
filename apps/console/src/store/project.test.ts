import { describe, expect, it, vi, beforeEach } from "vitest";

describe("project store", () => {
  beforeEach(() => {
    vi.resetModules();
  });

  it("初始无项目", async () => {
    const { projectStore } = await import("./project");
    expect(projectStore.projectDir()).toBeNull();
    expect(projectStore.posts()).toEqual([]);
  });

  it("openProject 在非 tauri 抛错", async () => {
    const { projectStore } = await import("./project");
    await expect(projectStore.openProject("/tmp/blog")).rejects.toThrow("require_tauri");
  });
});
