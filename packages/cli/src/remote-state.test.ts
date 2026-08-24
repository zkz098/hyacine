import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it, beforeEach, afterEach } from "vitest";
import { loadRemoteState, saveRemoteState, isRemoteConfigured } from "./remote/state";

describe("remote state", () => {
  let tmp: string;
  let origEnv: string | undefined;
  beforeEach(() => {
    tmp = mkdtempSync(join(tmpdir(), "hyacine-state-"));
    origEnv = process.env.HYACINE_CONFIG_DIR;
    process.env.HYACINE_CONFIG_DIR = tmp;
  });
  afterEach(() => {
    process.env.HYACINE_CONFIG_DIR = origEnv;
    rmSync(tmp, { recursive: true, force: true });
  });

  it("isRemoteConfigured false when empty", () => {
    expect(isRemoteConfigured({})).toBe(false);
    expect(isRemoteConfigured({ apiUrl: "https://x" })).toBe(false);
  });

  it("save and load roundtrip", () => {
    saveRemoteState({
      apiUrl: "https://api.example.com",
      apiToken: "tok",
      lastSync: { at: new Date().toISOString(), paths: ["a.md"] },
    });
    const loaded = loadRemoteState();
    expect(loaded.apiUrl).toBe("https://api.example.com");
    expect(loaded.apiToken).toBe("tok");
    expect(loaded.lastSync?.paths).toEqual(["a.md"]);
    expect(isRemoteConfigured(loaded)).toBe(true);
  });
});
