import { HashRouter, Route, useNavigate } from "@solidjs/router";
import type { JSX } from "solid-js";
import { AppLayout } from "./layouts/AppLayout";
import { Login } from "./pages/Login";
import { Dashboard } from "./pages/Dashboard";
import { Posts } from "./pages/Posts";
import { Sync } from "./pages/Sync";
import { Assets } from "./pages/Assets";
import { Tokens } from "./pages/Tokens";
import { Settings } from "./pages/Settings";
import { Workspace } from "./pages/Workspace";
import { Editor } from "./pages/Editor";
import { Git } from "./pages/Git";
import { Install } from "./pages/Install";
import { apiStore } from "./store/api";
import { isTauri } from "./tauri/bridge";

export interface GuardProps {
  children: JSX.Element;
}

/** 云平面守卫：需要 API 登录（dashboard/posts/sync/assets/tokens） */
export function CloudGuarded(props: GuardProps): JSX.Element | null {
  const navigate = useNavigate();
  if (!apiStore.isAuthed()) {
    navigate("/login");
    return null;
  }
  return <>{props.children}</>;
}

function LayoutGuarded(props: { children: JSX.Element }): JSX.Element {
  return (
    <CloudGuarded>
      <AppLayout>{props.children}</AppLayout>
    </CloudGuarded>
  );
}

/** 本地（桌面）平面守卫：isTauri 即可用，无需 API 登录（workspace/editor/git） */
export function LocalGuarded(props: GuardProps): JSX.Element | null {
  const navigate = useNavigate();
  if (!isTauri()) {
    navigate("/login");
    return null;
  }
  return <>{props.children}</>;
}

function LocalLayoutGuarded(props: { children: JSX.Element }): JSX.Element {
  return (
    <LocalGuarded>
      <AppLayout>{props.children}</AppLayout>
    </LocalGuarded>
  );
}

/** 环境感知守卫：设置页——桌面离线可用（选目录/配 API），Web 需登录 */
export function EnvGuarded(props: GuardProps): JSX.Element | null {
  const navigate = useNavigate();
  if (!apiStore.isAuthed() && !isTauri()) {
    navigate("/login");
    return null;
  }
  return <>{props.children}</>;
}

function EnvLayoutGuarded(props: { children: JSX.Element }): JSX.Element {
  return (
    <EnvGuarded>
      <AppLayout>{props.children}</AppLayout>
    </EnvGuarded>
  );
}

export function App(): JSX.Element {
  return (
    <HashRouter>
      <Route path="/login" component={Login} />
      <Route
        path="/"
        component={() => (
          <LayoutGuarded>
            <Dashboard />
          </LayoutGuarded>
        )}
      />
      <Route
        path="/posts"
        component={() => (
          <LayoutGuarded>
            <Posts />
          </LayoutGuarded>
        )}
      />
      <Route
        path="/sync"
        component={() => (
          <LayoutGuarded>
            <Sync />
          </LayoutGuarded>
        )}
      />
      <Route
        path="/assets"
        component={() => (
          <LayoutGuarded>
            <Assets />
          </LayoutGuarded>
        )}
      />
      <Route
        path="/tokens"
        component={() => (
          <LayoutGuarded>
            <Tokens />
          </LayoutGuarded>
        )}
      />
      <Route
        path="/settings"
        component={() => (
          <EnvLayoutGuarded>
            <Settings />
          </EnvLayoutGuarded>
        )}
      />
      <Route
        path="/workspace"
        component={() => (
          <LocalLayoutGuarded>
            <Workspace />
          </LocalLayoutGuarded>
        )}
      />
      <Route
        path="/editor"
        component={() => (
          <LocalLayoutGuarded>
            <Editor />
          </LocalLayoutGuarded>
        )}
      />
      <Route
        path="/git"
        component={() => (
          <LocalLayoutGuarded>
            <Git />
          </LocalLayoutGuarded>
        )}
      />
      <Route
        path="/install"
        component={() => (
          <LocalGuarded>
            <Install />
          </LocalGuarded>
        )}
      />
    </HashRouter>
  );
}
