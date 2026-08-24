import { createSignal, Show } from "solid-js";
import { t } from "../i18n";
import { apiStore } from "../store/api";
import { messageOf } from "../store/errors";
import { Alert } from "../components/Alert";

export function Settings(): import("solid-js").JSX.Element {
  const [url, setUrl] = createSignal(apiStore.state.baseUrl);
  const [saved, setSaved] = createSignal(false);
  const [health, setHealth] = createSignal<{
    ok: boolean;
    version: string;
    needsSetup: boolean;
    ai: { summary: boolean; embed: boolean };
  } | null>(null);
  const [healthError, setHealthError] = createSignal<string | null>(null);
  const [healthLoading, setHealthLoading] = createSignal(false);

  const [theme, setThemeSignal] = createSignal(apiStore.state.theme);

  const handleSave = (): void => {
    apiStore.setBaseUrl(url().trim());
    setSaved(true);
    setTimeout(() => setSaved(false), 1500);
  };

  const handleTest = async (): Promise<void> => {
    setHealthLoading(true);
    setHealthError(null);
    setHealth(null);
    try {
      // temporarily use current input url for test
      const testUrl = url().trim();
      const prevUrl = apiStore.state.baseUrl;
      if (testUrl !== prevUrl) apiStore.setBaseUrl(testUrl);
      const client = apiStore.getClient();
      const res = await client.health();
      setHealth(res);
      if (testUrl !== prevUrl) apiStore.setBaseUrl(prevUrl);
    } catch (err: unknown) {
      setHealthError(messageOf(err));
    } finally {
      setHealthLoading(false);
    }
  };

  const handleTheme = (next: "light" | "dark"): void => {
    setThemeSignal(next);
    apiStore.setTheme(next);
  };

  // oxlint-disable-next-line unicorn/consistent-function-scoping -- uses apiStore, keep inside
  const handleLogout = (): void => {
    apiStore.clearAuth();
    location.hash = "#/login";
  };

  return (
    <div class="flex flex-col gap-4 max-w-lg">
      <h1 class="text-xl font-bold">{t("settings.title")}</h1>

      <div class="surface p-4 flex flex-col gap-3">
        <label class="flex flex-col gap-1 text-sm">
          <span>{t("settings.apiUrl")}</span>
          <input
            value={url()}
            onInput={(e) => setUrl(e.currentTarget.value)}
            placeholder="https://your-api.workers.dev"
            class="px-3 py-2 rounded border border-[var(--border)] bg-[var(--bg)] text-sm"
          />
        </label>
        <div class="flex gap-2">
          <button
            type="button"
            onClick={handleSave}
            class="px-4 py-2 rounded bg-[var(--accent)] text-white text-sm hover:bg-[var(--accent-hover)]"
          >
            {t("settings.save")}
          </button>
          <button
            type="button"
            onClick={() => void handleTest()}
            disabled={healthLoading()}
            class="px-4 py-2 rounded border border-[var(--border)] text-sm hover:bg-[var(--bg)] disabled:opacity-50"
          >
            {t("settings.test")}
          </button>
          <Show when={saved()}>
            <span class="text-sm text-[var(--ok)] self-center">{t("settings.saved")}</span>
          </Show>
        </div>
        <Show when={healthError() !== null}>
          <Alert variant="error">{healthError()}</Alert>
        </Show>
        <Show when={health()}>
          {(h) => (
            <Alert variant="info">
              <div class="text-xs flex flex-col gap-1">
                <span>
                  ok: {String(h().ok)} · version: {h().version}
                </span>
                <span>
                  ai.summary: {String(h().ai.summary)} · ai.embed: {String(h().ai.embed)}
                </span>
                <Show when={h().needsSetup}>
                  <span>needsSetup: true</span>
                </Show>
              </div>
            </Alert>
          )}
        </Show>
      </div>

      <div class="surface p-4 flex flex-col gap-3">
        <h2 class="font-semibold text-sm">{t("settings.theme")}</h2>
        <div class="flex gap-2">
          <button
            type="button"
            onClick={() => handleTheme("light")}
            class={`px-3 py-1.5 rounded border text-sm ${theme() === "light" ? "bg-[var(--accent)] text-white border-transparent" : "border-[var(--border)]"}`}
          >
            {t("settings.theme.light")}
          </button>
          <button
            type="button"
            onClick={() => handleTheme("dark")}
            class={`px-3 py-1.5 rounded border text-sm ${theme() === "dark" ? "bg-[var(--accent)] text-white border-transparent" : "border-[var(--border)]"}`}
          >
            {t("settings.theme.dark")}
          </button>
        </div>
      </div>

      <div class="surface p-4 flex flex-col gap-2">
        <button
          type="button"
          onClick={handleLogout}
          class="self-start px-4 py-2 rounded bg-red-50 text-red-600 text-sm border border-red-200 hover:bg-red-100"
        >
          {t("settings.logout")}
        </button>
        <p class="text-xs text-muted">{t("settings.version")}: 0.1.0</p>
      </div>
    </div>
  );
}
