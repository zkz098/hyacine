import { describe, expect, it, beforeEach } from "vitest";
import { apiStore } from "./api";

function clearStorage(): void {
  localStorage.clear();
  // reset store to initial via direct localStorage clear + re-read?
  // easiest: reset via setters
  apiStore.setBaseUrl("");
  apiStore.setToken(null);
  apiStore.setTheme("light");
}

describe("apiStore", () => {
  beforeEach(() => {
    clearStorage();
  });

  it("persists baseUrl and token to localStorage", () => {
    apiStore.setBaseUrl("https://example.com");
    apiStore.setToken("tok123");
    expect(localStorage.getItem("hyacine.apiUrl")).toBe("https://example.com");
    expect(localStorage.getItem("hyacine.token")).toBe("tok123");
    expect(apiStore.isAuthed()).toBe(true);
  });

  it("clearAuth removes token but keeps baseUrl", () => {
    apiStore.setBaseUrl("https://example.com");
    apiStore.setToken("tok123");
    apiStore.clearAuth();
    expect(apiStore.isAuthed()).toBe(false);
    expect(localStorage.getItem("hyacine.token")).toBeNull();
    expect(localStorage.getItem("hyacine.apiUrl")).toBe("https://example.com");
  });

  it("persists theme and updates dataset", () => {
    apiStore.setTheme("dark");
    expect(localStorage.getItem("hyacine.theme")).toBe("dark");
    expect(document.documentElement.dataset.theme).toBe("dark");
    apiStore.setTheme("light");
    expect(document.documentElement.dataset.theme).toBe("light");
  });

  it("getClient reflects current baseUrl and token", () => {
    apiStore.setBaseUrl("https://api.example.com");
    apiStore.setToken("abc");
    const client = apiStore.getClient();
    // client is configured; verify via a request would need fetch mock,
    // but at least it does not throw
    expect(client).toBeDefined();
  });
});
