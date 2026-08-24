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
import { apiStore } from "./store/api";

function Guarded(props: { children: JSX.Element }): JSX.Element | null {
  const navigate = useNavigate();
  if (!apiStore.isAuthed()) {
    navigate("/login");
    return null;
  }
  return <>{props.children}</>;
}

function LayoutGuarded(props: { children: JSX.Element }): JSX.Element {
  return (
    <Guarded>
      <AppLayout>{props.children}</AppLayout>
    </Guarded>
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
          <LayoutGuarded>
            <Settings />
          </LayoutGuarded>
        )}
      />
      <Route
        path="/workspace"
        component={() => (
          <LayoutGuarded>
            <Workspace />
          </LayoutGuarded>
        )}
      />
      <Route
        path="/editor"
        component={() => (
          <LayoutGuarded>
            <Editor />
          </LayoutGuarded>
        )}
      />
      <Route
        path="/git"
        component={() => (
          <LayoutGuarded>
            <Git />
          </LayoutGuarded>
        )}
      />
    </HashRouter>
  );
}
