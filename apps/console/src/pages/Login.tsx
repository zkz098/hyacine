import { createSignal, Show } from "solid-js";
import { useNavigate } from "@solidjs/router";
import { t } from "../i18n";
import { apiStore } from "../store/api";
import { messageOf } from "../store/errors";
import { Alert } from "../components/Alert";
import { Button } from "../components/Button";
import { Input } from "../components/Input";
import { Card } from "../components/Card";
import { isTauri } from "../tauri/bridge";
import { toast } from "../components/Toast";

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
      toast.success(t("login.success"));
      navigate("/");
    } catch (err: unknown) {
      setError(messageOf(err));
      toast.error(messageOf(err), t("login.failed"));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div class="min-h-screen flex items-center justify-center bg-[var(--bg)] p-4 relative overflow-hidden">
      {/* Subtle background decoration */}
      <div class="absolute -top-40 -right-40 w-96 h-96 bg-[var(--accent)]/5 rounded-full blur-3xl pointer-events-none" />
      <div class="absolute -bottom-40 -left-40 w-96 h-96 bg-[var(--note-info-bg)] rounded-full blur-3xl pointer-events-none" />

      <Card class="w-full max-w-md p-6 sm:p-8 flex flex-col gap-5 shadow-lg border-[var(--border)] relative z-10">
        {/* Brand header */}
        <div class="flex flex-col items-center text-center gap-2 pb-2">
          <div class="w-12 h-12 rounded-xl bg-[var(--accent)] text-white flex items-center justify-center text-2xl shadow-sm">
            <span class="i-ri-quill-pen-line" />
          </div>
          <h1 class="text-xl font-bold tracking-tight text-[var(--text)]">{t("login.title")}</h1>
          <p class="text-xs text-[var(--muted)]">Cloudflare D1/R2 云平面管理中心</p>
        </div>

        <Show when={error() !== null}>
          <Alert variant="error" title="登录失败">
            {error()}
          </Alert>
        </Show>

        <form
          onSubmit={(e) => {
            e.preventDefault();
            void handleLogin();
          }}
          class="flex flex-col gap-4"
        >
          <Input
            label={t("login.apiUrl")}
            value={url()}
            onInput={(e) => setUrl(e.currentTarget.value)}
            placeholder={t("login.apiUrl.placeholder")}
            icon="i-ri-global-line"
          />

          <Input
            label={t("login.code")}
            value={code()}
            onInput={(e) => setCode(e.currentTarget.value)}
            type="password"
            placeholder={t("login.code.placeholder")}
            icon="i-ri-lock-password-line"
            helperText={t("login.needsSetup")}
          />

          <Button
            type="submit"
            variant="primary"
            size="md"
            loading={loading()}
            class="w-full mt-2"
            icon="i-ri-login-box-line"
          >
            {t("login.submit")}
          </Button>
        </form>

        {isTauri() && (
          <div class="flex flex-col gap-2 pt-3 border-t border-[var(--border)]">
            <Button
              variant="outline"
              size="sm"
              class="w-full"
              icon="i-ri-hard-drive-2-line"
              onClick={() => navigate("/workspace")}
            >
              {t("login.skipLocal")}
            </Button>
            <Button
              variant="secondary"
              size="sm"
              class="w-full"
              icon="i-ri-rocket-line"
              onClick={() => navigate("/install")}
            >
              🚀 安装 Blog（Setup 模式）
            </Button>
          </div>
        )}
      </Card>
    </div>
  );
}
