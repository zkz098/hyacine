import { beforeEach, describe, expect, it } from "vitest";
import { loadEnabledPlugins, saveEnabledPlugins, togglePluginEnabled } from "./pluginSettings";

const KEY = "hyacine.syntaxPlugins";

beforeEach(() => {
  window.localStorage.clear();
});

describe("pluginSettings", () => {
  it("默认启用 shokax-basic", () => {
    expect(loadEnabledPlugins()).toEqual(["shokax-basic"]);
  });

  it("保存/读取往返", () => {
    saveEnabledPlugins(["shokax-basic", "myx"]);
    expect(loadEnabledPlugins()).toEqual(["shokax-basic", "myx"]);
  });

  it("损坏数据回退默认", () => {
    window.localStorage.setItem(KEY, "{not-json");
    expect(loadEnabledPlugins()).toEqual(["shokax-basic"]);
    window.localStorage.setItem(KEY, JSON.stringify({ enabled: "bad" }));
    expect(loadEnabledPlugins()).toEqual(["shokax-basic"]);
  });

  it("toggle 开关", () => {
    expect(togglePluginEnabled("shokax-basic", false)).toEqual([]);
    expect(loadEnabledPlugins()).toEqual([]);
    expect(togglePluginEnabled("shokax-basic", true)).toEqual(["shokax-basic"]);
  });
});
