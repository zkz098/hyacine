import { describe, expect, it } from "vitest";
import { render, screen } from "@solidjs/testing-library";
import { MemoryRouter, Route } from "@solidjs/router";
import { Workspace } from "./Workspace";

describe("Workspace", () => {
  it("非 tauri 显示提示", () => {
    render(() => (
      <MemoryRouter>
        <Route path="/" component={Workspace} />
      </MemoryRouter>
    ));
    expect(screen.getByText("此功能仅桌面模式可用")).toBeInTheDocument();
  });

  it("显示工作台标题", () => {
    render(() => (
      <MemoryRouter>
        <Route path="/" component={Workspace} />
      </MemoryRouter>
    ));
    expect(screen.getByText("工作台")).toBeInTheDocument();
  });
});
