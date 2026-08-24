import { describe, expect, it } from "vitest";
import { HyacineApiError } from "@hyacine/contract";
import { messageOf } from "./errors";

describe("messageOf", () => {
  it("maps unauthorized", () => {
    const err = new HyacineApiError(401, "unauthorized", "token invalid");
    expect(messageOf(err)).toBe("登录已失效，请重新登录");
  });

  it("maps network_error", () => {
    const err = new HyacineApiError(0, "network_error", "fetch failed");
    expect(messageOf(err)).toBe("无法连接 API");
  });

  it("falls back to err.message for unknown code", () => {
    const err = new HyacineApiError(400, "validation_error", "参数错误");
    expect(messageOf(err)).toBe("参数错误");
  });

  it("handles non-ApiError", () => {
    expect(messageOf(new Error("boom"))).toBe("boom");
    expect(messageOf("plain string")).toBe("plain string");
  });
});
