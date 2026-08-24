import { createSignal, type JSX } from "solid-js";
import { A, useNavigate } from "@solidjs/router";
import { t } from "../i18n";
import { apiStore } from "../store/api";
import { isTauri } from "../tauri/bridge";

const baseNavItems = [
  { href: "/", label: "nav.dashboard", icon: "i-ri-dashboard-line" },
  { href: "/posts", label: "nav.posts", icon: "i-ri-article-line" },
  { href: "/sync", label: "nav.sync", icon: "i-ri-refresh-line" },
  { href: "/assets", label: "nav.assets", icon: "i-ri-image-line" },
  { href: "/tokens", label: "nav.tokens", icon: "i-ri-key-2-line" },
  { href: "/settings", label: "nav.settings", icon: "i-ri-settings-3-line" },
] as const;

const desktopNavItems = [
  { href: "/workspace", label: "workspace.title", icon: "i-ri-hard-drive-2-line" },
  { href: "/editor", label: "editor.title", icon: "i-ri-quill-pen-line" },
  { href: "/git", label: "git.title", icon: "i-ri-git-branch-line" },
] as const;

export function AppLayout(props: { children: JSX.Element }): JSX.Element {
  const navigate = useNavigate();
  const [open, setOpen] = createSignal(false);

  // oxlint-disable-next-line unicorn/consistent-function-scoping -- captures navigate/theme, keep inside component
  const handleLogout = (): void => {
    apiStore.clearAuth();
    navigate("/login");
  };

  // oxlint-disable-next-line unicorn/consistent-function-scoping -- reads apiStore.state.theme
  const toggleTheme = (): void => {
    apiStore.setTheme(apiStore.state.theme === "dark" ? "light" : "dark");
  };

  return (
    <div class="min-h-screen flex">
      {/* sidebar */}
      <aside
        class={`w-56 shrink-0 border-r bg-[var(--surface)] border-[var(--border)] flex flex-col
          fixed inset-y-0 left-0 z-20 transition-transform
          lg:translate-x-0 ${open() ? "translate-x-0" : "-translate-x-full lg:translate-x-0"}`}
      >
        <div class="h-14 flex items-center px-4 border-b border-[var(--border)] font-bold text-lg">
          <span class="i-ri-quill-pen-line mr-2 text-[var(--accent)]" />
          hyacine
        </div>
        <nav class="flex-1 p-2 flex flex-col gap-1">
          {baseNavItems.map((item) => (
            <A
              href={item.href}
              end={item.href === "/"}
              class="flex items-center gap-2 px-3 py-2 rounded text-sm text-[var(--muted)] hover:bg-[var(--bg)] hover:text-[var(--text)]"
              activeClass="bg-[var(--bg)] text-[var(--text)] font-medium"
              onClick={() => setOpen(false)}
            >
              <span class={item.icon} />
              {t(item.label)}
            </A>
          ))}
          {isTauri() && (
            <>
              <div class="my-1 border-t border-[var(--border)]" />
              {desktopNavItems.map((item) => (
                <A
                  href={item.href}
                  class="flex items-center gap-2 px-3 py-2 rounded text-sm text-[var(--muted)] hover:bg-[var(--bg)] hover:text-[var(--text)]"
                  activeClass="bg-[var(--bg)] text-[var(--text)] font-medium"
                  onClick={() => setOpen(false)}
                >
                  <span class={item.icon} />
                  {t(item.label)}
                </A>
              ))}
            </>
          )}
        </nav>
        <div class="p-3 border-t border-[var(--border)]">
          <button
            type="button"
            onClick={handleLogout}
            class="w-full flex items-center gap-2 px-3 py-2 rounded text-sm text-[var(--muted)] hover:bg-[var(--bg)]"
          >
            <span class="i-ri-logout-box-line" />
            {t("nav.logout")}
          </button>
        </div>
      </aside>

      {/* overlay */}
      {open() && (
        <button
          type="button"
          aria-label="close sidebar"
          class="fixed inset-0 bg-black/30 z-10 lg:hidden"
          onClick={() => setOpen(false)}
        />
      )}

      {/* main */}
      <div class="flex-1 lg:ml-56 flex flex-col min-w-0">
        <header class="h-14 flex items-center justify-between px-4 border-b bg-[var(--surface)] border-[var(--border)] sticky top-0 z-10">
          <button
            type="button"
            class="lg:hidden p-2 rounded hover:bg-[var(--bg)]"
            onClick={() => setOpen((v) => !v)}
            aria-label="menu"
          >
            <span class="i-ri-menu-line text-xl" />
          </button>
          <div class="flex items-center gap-2 ml-auto">
            {isTauri() && !apiStore.isAuthed() ? (
              <span class="text-xs px-2 py-0.5 rounded-full border border-[var(--border)] text-[var(--muted)]">
                {t("mode.local")}
              </span>
            ) : (
              <span
                class={`text-xs px-2 py-0.5 rounded-full border ${
                  apiStore.isAuthed()
                    ? "border-[var(--ok)] text-[var(--ok)]"
                    : "border-[var(--danger)] text-[var(--danger)]"
                }`}
              >
                {t(apiStore.isAuthed() ? "mode.cloud" : "mode.disconnected")}
              </span>
            )}
            <button
              type="button"
              onClick={toggleTheme}
              class="p-2 rounded hover:bg-[var(--bg)]"
              aria-label="toggle theme"
            >
              <span class={apiStore.state.theme === "dark" ? "i-ri-sun-line" : "i-ri-moon-line"} />
            </button>
          </div>
        </header>
        <main class="flex-1 p-4 lg:p-6">{props.children}</main>
      </div>
    </div>
  );
}
