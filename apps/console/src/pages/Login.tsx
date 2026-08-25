import { createSignal, Show } from "solid-js";
import { useNavigate } from "@solidjs/router";
import { t } from "../i18n";
import { apiStore } from "../store/api";
import { messageOf } from "../store/errors";
import { Alert } from "../components/Alert";
import { isTauri } from "../tauri/bridge";

export function Login(): import("solid-js").JSX.Element {
  const navigate = useNavigate();
  const [url, setUrl] = createSignal(apiStore.state.baseUrl);
  const [code, setCode] = createSignal("");
  const [error, setError] = createSignal<string | null>(null);
  const [loading, setLoading] = createSignal(false);

  const handleLogin = async (): Promise<void> => {
    const baseUrl = url().trim();
    const setupCode = code().trim();
    if (baseUrl.length === 0 || setupCode.length === 0) {
      setError("请填写 API 地址和 Setup Code");
      return;
    }
    setLoading(true);
    setError(null);
    try {
      apiStore.setBaseUrl(baseUrl);
      const client = apiStore.getClient();
      const res = await client.setup({ code: setupCode, label: "console" });
      apiStore.setToken(res.token);
      navigate("/");
    } catch (err: unknown) {
      setError(messageOf(err));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div class="min-h-screen flex items-center justify-center bg-[var(--bg)] p-4">
      <div class="w-full max-w-sm surface p-6 flex flex-col gap-4">
        <h1 class="text-xl font-bold text-center">{t("login.title")}</h1>
        <Show when={error() !== null}>
          <Alert variant="error">{error()}</Alert>
        </Show>
        <label class="flex flex-col gap-1 text-sm">
          <span>{t("login.apiUrl")}</span>
          <input
            value={url()}
            onInput={(e) => setUrl(e.currentTarget.value)}
            placeholder={t("login.apiUrl.placeholder")}
            class="px-3 py-2 rounded border border-[var(--border)] bg-[var(--bg)] text-sm"
          />
        </label>
        <label class="flex flex-col gap-1 text-sm">
          <span>{t("login.code")}</span>
          <input
            value={code()}
            onInput={(e) => setCode(e.currentTarget.value)}
            placeholder={t("login.code.placeholder")}
            class="px-3 py-2 rounded border border-[var(--border)] bg-[var(--bg)] text-sm"
          />
        </label>
        <p class="text-xs text-muted">{t("login.needsSetup")}</p>
        <button
          type="button"
          onClick={() => void handleLogin()}
          disabled={loading()}
          class="w-full py-2 rounded bg-[var(--accent)] text-white text-sm font-medium hover:bg-[var(--accent-hover)] disabled:opacity-50"
        >
          {loading() ? "..." : t("login.submit")}
        </button>
        {isTauri() && (
          <>
            <button
              type="button"
              onClick={() => navigate("/workspace")}
              class="w-full py-2 rounded border border-[var(--border)] text-sm text-[var(--muted)] hover:text-[var(--text)]"
            >
              {t("login.skipLocal")}
            </button>
            <button
              type="button"
              onClick={() => navigate("/install")}
              class="w-full py-2 rounded border border-[var(--border)] text-sm text-[var(--muted)] hover:text-[var(--text)]"
            >
              🚀 安装 Blog（Setup 模式）
            </button>
          </>
        )}
      </div>
    </div>
  );
}
