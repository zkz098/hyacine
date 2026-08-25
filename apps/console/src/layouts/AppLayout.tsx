import { createSignal, Show, type JSX } from "solid-js";
import { A, useNavigate, useLocation } from "@solidjs/router";
import { t } from "../i18n";
import { apiStore } from "../store/api";
import { projectStore } from "../store/project";
import { isTauri } from "../tauri/bridge";
import { ToastContainer } from "../components/Toast";
import { Badge } from "../components/Badge";

interface NavItem {
  href: string;
  label: string;
  icon: string;
}

const cloudNavItems: readonly NavItem[] = [
  { href: "/", label: "nav.dashboard", icon: "i-ri-dashboard-3-line" },
  { href: "/posts", label: "nav.posts", icon: "i-ri-article-line" },
  { href: "/sync", label: "nav.sync", icon: "i-ri-refresh-line" },
  { href: "/assets", label: "nav.assets", icon: "i-ri-image-line" },
  { href: "/tokens", label: "nav.tokens", icon: "i-ri-key-2-line" },
];

const desktopNavItems: readonly NavItem[] = [
  { href: "/workspace", label: "workspace.title", icon: "i-ri-folder-open-line" },
  { href: "/editor", label: "editor.title", icon: "i-ri-quill-pen-line" },
  { href: "/git", label: "git.title", icon: "i-ri-git-branch-line" },
];

export function AppLayout(props: { children: JSX.Element }): JSX.Element {
  const navigate = useNavigate();
  const location = useLocation();
  const [open, setOpen] = createSignal(false);

  const handleLogout = (): void => {
    apiStore.clearAuth();
    navigate("/login");
  };

  const toggleTheme = (): void => {
    apiStore.setTheme(apiStore.state.theme === "dark" ? "light" : "dark");
  };

  const currentProjectName = (): string | null => {
    const dir = projectStore.projectDir();
    if (!dir) return null;
    const parts = dir.replace(/\\/g, "/").split("/");
    return parts.pop() || dir;
  };

  return (
    <div class="min-h-screen flex bg-[var(--bg)] text-[var(--text)] font-sans antialiased selection:bg-[var(--accent)] selection:text-white">
      {/* Toast notifications container */}
      <ToastContainer />

      {/* Sidebar */}
      <aside
        class={`w-60 shrink-0 border-r bg-[var(--surface)] border-[var(--border)] flex flex-col
          fixed inset-y-0 left-0 z-30 transition-transform duration-200 ease-out shadow-sm
          lg:translate-x-0 ${open() ? "translate-x-0" : "-translate-x-full lg:translate-x-0"}`}
      >
        {/* Brand header */}
        <div class="h-14 flex items-center justify-between px-4 border-b border-[var(--border)] brand-gradient shrink-0">
          <div class="flex items-center gap-2.5 font-bold text-base tracking-tight">
            <div class="w-8 h-8 rounded-md bg-[var(--accent)] text-white flex items-center justify-center shadow-xs">
              <span class="i-ri-quill-pen-line text-lg" />
            </div>
            <div class="flex flex-col">
              <span class="font-bold leading-tight">hyacine</span>
              <span class="text-[10px] text-[var(--muted)] font-mono font-normal">Astro ShokaX Studio</span>
            </div>
          </div>
          <Badge size="sm" variant={isTauri() ? "primary" : "neutral"}>
            {isTauri() ? "Desktop" : "Web"}
          </Badge>
        </div>

        {/* Navigation list */}
        <nav class="flex-1 px-3 py-4 flex flex-col gap-5 overflow-y-auto">
          {/* Cloud plane group */}
          <div class="flex flex-col gap-1">
            <div class="px-2.5 mb-1 flex items-center justify-between">
              <span class="text-[11px] font-semibold text-[var(--muted)] uppercase tracking-wider">
                云端管理
              </span>
              <Show when={apiStore.isAuthed()}>
                <span class="w-2 h-2 rounded-full bg-[var(--ok)] ring-2 ring-[var(--ok)]/20" title="已连接云端" />
              </Show>
            </div>
            {cloudNavItems.map((item) => {
              const isSelected = (): boolean =>
                item.href === "/" ? location.pathname === "/" : location.pathname.startsWith(item.href);
              return (
                <A
                  href={item.href}
                  end={item.href === "/"}
                  class={`flex items-center gap-2.5 px-3 py-2 rounded-[5px] text-xs font-medium transition-all ${
                    isSelected()
                      ? "bg-[var(--accent)] text-white shadow-xs font-semibold"
                      : "text-[var(--muted)] hover:bg-[var(--g-2)] hover:text-[var(--text)]"
                  }`}
                  onClick={() => setOpen(false)}
                >
                  <span class={`${item.icon} text-base shrink-0`} />
                  <span>{t(item.label)}</span>
                </A>
              );
            })}
          </div>

          {/* Desktop workspace group */}
          {isTauri() && (
            <div class="flex flex-col gap-1">
              <div class="px-2.5 mb-1 flex items-center justify-between">
                <span class="text-[11px] font-semibold text-[var(--muted)] uppercase tracking-wider">
                  本地工作区
                </span>
                <Show when={projectStore.projectDir() !== null}>
                  <span class="text-[10px] text-[var(--muted)] truncate max-w-[80px]" title={projectStore.projectDir() ?? ""}>
                    {currentProjectName()}
                  </span>
                </Show>
              </div>
              {desktopNavItems.map((item) => {
                const isSelected = (): boolean => location.pathname.startsWith(item.href);
                return (
                  <A
                    href={item.href}
                    class={`flex items-center gap-2.5 px-3 py-2 rounded-[5px] text-xs font-medium transition-all ${
                      isSelected()
                        ? "bg-[var(--accent)] text-white shadow-xs font-semibold"
                        : "text-[var(--muted)] hover:bg-[var(--g-2)] hover:text-[var(--text)]"
                    }`}
                    onClick={() => setOpen(false)}
                  >
                    <span class={`${item.icon} text-base shrink-0`} />
                    <span>{t(item.label)}</span>
                  </A>
                );
              })}
            </div>
          )}

          {/* System group */}
          <div class="flex flex-col gap-1">
            <div class="px-2.5 mb-1">
              <span class="text-[11px] font-semibold text-[var(--muted)] uppercase tracking-wider">
                系统
              </span>
            </div>
            <A
              href="/settings"
              class={`flex items-center gap-2.5 px-3 py-2 rounded-[5px] text-xs font-medium transition-all ${
                location.pathname.startsWith("/settings")
                  ? "bg-[var(--accent)] text-white shadow-xs font-semibold"
                  : "text-[var(--muted)] hover:bg-[var(--g-2)] hover:text-[var(--text)]"
              }`}
              onClick={() => setOpen(false)}
            >
              <span class="i-ri-settings-3-line text-base shrink-0" />
              <span>{t("nav.settings")}</span>
            </A>
          </div>
        </nav>

        {/* Sidebar Footer */}
        <div class="p-3 border-t border-[var(--border)] flex flex-col gap-2 bg-[var(--g-1)] shrink-0">
          <div class="flex items-center justify-between px-1 text-xs">
            <div class="flex items-center gap-1.5 min-w-0">
              <span
                class={`w-2 h-2 rounded-full shrink-0 ${
                  apiStore.isAuthed()
                    ? "bg-[var(--ok)]"
                    : isTauri()
                      ? "bg-[var(--muted)]"
                      : "bg-[var(--danger)]"
                }`}
              />
              <span class="text-xs text-[var(--muted)] truncate">
                {apiStore.isAuthed()
                  ? "API 已连接"
                  : isTauri()
                    ? "本地离线"
                    : "未连接"}
              </span>
            </div>
            <button
              type="button"
              onClick={toggleTheme}
              class="w-7 h-7 rounded-md border border-[var(--border)] bg-[var(--surface)] hover:bg-[var(--g-2)] flex items-center justify-center text-[var(--muted)] hover:text-[var(--text)] transition-colors cursor-pointer"
              title="切换明暗主题"
              aria-label="Toggle Theme"
            >
              <span class={apiStore.state.theme === "dark" ? "i-ri-sun-line text-sm" : "i-ri-moon-line text-sm"} />
            </button>
          </div>
          <button
            type="button"
            onClick={handleLogout}
            class="w-full flex items-center justify-center gap-2 px-3 py-1.5 rounded-[4px] text-xs text-[var(--note-danger-text)] hover:bg-[var(--note-danger-bg)] border border-transparent hover:border-[var(--note-danger-border)] transition-colors cursor-pointer"
          >
            <span class="i-ri-logout-box-r-line" />
            <span>{t("nav.logout")}</span>
          </button>
        </div>
      </aside>

      {/* Mobile Overlay */}
      {open() && (
        <div
          class="fixed inset-0 bg-black/40 backdrop-blur-xs z-20 lg:hidden animate-fade-in"
          onClick={() => setOpen(false)}
          aria-hidden="true"
        />
      )}

      {/* Main Content Pane */}
      <div class="flex-1 lg:ml-60 flex flex-col min-w-0 min-h-screen">
        {/* Top Header */}
        <header class="h-14 flex items-center justify-between px-4 sm:px-6 border-b bg-[var(--surface)]/90 backdrop-blur-sm border-[var(--border)] sticky top-0 z-20 shadow-2xs">
          <div class="flex items-center gap-3">
            <button
              type="button"
              class="lg:hidden p-1.5 rounded-md hover:bg-[var(--g-2)] text-[var(--text)] transition-colors"
              onClick={() => setOpen((v) => !v)}
              aria-label="Open navigation menu"
            >
              <span class="i-ri-menu-line text-lg" />
            </button>
            <Show when={isTauri() && projectStore.projectDir() !== null}>
              <div class="hidden sm:flex items-center gap-1.5 text-xs text-[var(--muted)] bg-[var(--bg)] border border-[var(--border)] px-2.5 py-1 rounded-[4px]">
                <span class="i-ri-folder-3-line text-[var(--accent)]" />
                <span class="font-mono text-[11px] truncate max-w-xs">{projectStore.projectDir()}</span>
              </div>
            </Show>
          </div>

          <div class="flex items-center gap-3">
            {isTauri() && !apiStore.isAuthed() ? (
              <Badge variant="neutral" dot>
                {t("mode.local")}
              </Badge>
            ) : (
              <Badge variant={apiStore.isAuthed() ? "success" : "danger"} dot>
                {t(apiStore.isAuthed() ? "mode.cloud" : "mode.disconnected")}
              </Badge>
            )}

            <button
              type="button"
              onClick={toggleTheme}
              class="w-8 h-8 rounded-md hover:bg-[var(--g-2)] flex items-center justify-center text-[var(--muted)] hover:text-[var(--text)] transition-colors cursor-pointer"
              aria-label="toggle theme"
            >
              <span class={apiStore.state.theme === "dark" ? "i-ri-sun-line text-base" : "i-ri-moon-line text-base"} />
            </button>
          </div>
        </header>

        {/* Main Body */}
        <main class="flex-1 p-4 sm:p-6 lg:p-8 max-w-7xl w-full mx-auto animate-fade-in">
          {props.children}
        </main>
      </div>
    </div>
  );
}
