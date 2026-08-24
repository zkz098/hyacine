import { describe, expect, it } from "vitest";
import { render, screen } from "@solidjs/testing-library";
import { MemoryRouter, Route, createMemoryHistory } from "@solidjs/router";
import type { JSX } from "solid-js";
import { CloudGuarded, LocalGuarded, type GuardProps } from "./app";
import { apiStore } from "./store/api";

const TAURI_GLOBAL = "__TAURI_INTERNALS__";

function setTauriGlobal(value: boolean): void {
  // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- 注入 tauri 全局标识
  const w = window as unknown as Record<string, unknown>;
  if (value) {
    w[TAURI_GLOBAL] = {};
  } else {
    delete w[TAURI_GLOBAL];
  }
}

function withEnv(opts: { tauri?: boolean; token?: string }): void {
  setTauriGlobal(opts.tauri === true);
  // apiStore 的 state 是内存快照，登录态必须走 setToken 而非动 localStorage
  apiStore.setToken(opts.token ?? null);
}

function Root(props: { children?: JSX.Element }): JSX.Element {
  return <div>{props.children}</div>;
}

function Target(): JSX.Element {
  return <div data-testid="target" />;
}

function LoginStub(): JSX.Element {
  return <div data-testid="login" />;
}

function renderWithGuards(
  Guard: (props: GuardProps) => JSX.Element | null,
  opts: { tauri?: boolean; token?: string } = {},
): { history: ReturnType<typeof createMemoryHistory> } {
  withEnv(opts);
  const history = createMemoryHistory();
  history.set({ value: "/workspace", replace: true });
  render(() => (
    <MemoryRouter root={Root} history={history}>
      <Route
        path="/workspace"
        component={() => (
          <Guard>
            <Target />
          </Guard>
        )}
      />
      <Route path="/login" component={LoginStub} />
    </MemoryRouter>
  ));
  return { history };
}

describe("app guards（桌面离线模式）", () => {
  it("isTauri + 无 token：本地页可用（离线编辑），不跳登录", () => {
    renderWithGuards(LocalGuarded, { tauri: true });
    expect(screen.getByTestId("target")).toBeTruthy();
    expect(screen.queryByTestId("login")).toBeNull();
  });

  it("WebUI + 无 token：本地页被重定向到 /login", async () => {
    renderWithGuards(LocalGuarded);
    expect(screen.queryByTestId("target")).toBeNull();
    // navigate 在渲染期调用，路由切换异步生效
    expect(await screen.findByTestId("login")).toBeTruthy();
  });

  it("云平面无 token 一律跳 /login（即使桌面）", async () => {
    renderWithGuards(CloudGuarded, { tauri: true });
    expect(screen.queryByTestId("target")).toBeNull();
    expect(await screen.findByTestId("login")).toBeTruthy();
  });

  it("云平面有 token 正常渲染", () => {
    renderWithGuards(CloudGuarded, { token: "tok" });
    expect(screen.getByTestId("target")).toBeTruthy();
  });
});
